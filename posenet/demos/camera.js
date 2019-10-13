/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import * as posenet from '@tensorflow-models/posenet';
import * as tf from '@tensorflow/tfjs';
import dat from 'dat.gui';
import Stats from 'stats.js';
import { drawBoundingBox, drawKeypoints, drawPoint, drawSkeleton } from './demo_util';

const videoWidth = 600;
const videoHeight = 500;
const stats = new Stats();

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMobile() {
  return isAndroid() || isiOS();
}

const webSocket = new WebSocket('ws://localhost:8080');

async function fetchImageList() {
  const response = await fetch('http://localhost:3000/');
  const json = await response.json();
  console.log(json);
  return json;
}

/**
 * Loads a the camera to be used in the demo
 *
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const mobile = isMobile();
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: mobile ? undefined : videoWidth,
      height: mobile ? undefined : videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

const guiState = {
  algorithm: 'single-pose',
  input: {
    mobileNetArchitecture: isMobile() ? '0.50' : '0.75',
    outputStride: 16,
    imageScaleFactor: 0.5,
  },
  image: 'webcam',
  singlePoseDetection: {
    minPoseConfidence: 0.1,
    minPartConfidence: 0.5,
  },
  multiPoseDetection: {
    maxPoseDetections: 5,
    minPoseConfidence: 0.15,
    minPartConfidence: 0.1,
    nmsRadius: 30.0,
  },
  output: {
    showVideo: true,
    showSkeleton: true,
    showPoints: true,
    showBoundingBox: false,
  },
  net: null,
};

/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui(cameras, net, imageList) {
  guiState.net = net;

  if (cameras.length > 0) {
    guiState.camera = cameras[0].deviceId;
  }

  const gui = new dat.GUI({ width: 300 });
  gui.add(guiState, 'image', ['webcam', ...imageList]);

  // The single-pose algorithm is faster and simpler but requires only one
  // person to be in the frame or results will be innaccurate. Multi-pose works
  // for more than 1 person
  const algorithmController =
    gui.add(guiState, 'algorithm', ['single-pose', 'multi-pose']);

  // The input parameters have the most effect on accuracy and speed of the
  // network
  let input = gui.addFolder('Input');
  // Architecture: there are a few PoseNet models varying in size and
  // accuracy. 1.01 is the largest, but will be the slowest. 0.50 is the
  // fastest, but least accurate.
  const architectureController = input.add(
    guiState.input, 'mobileNetArchitecture',
    ['1.01', '1.00', '0.75', '0.50']);
  // Output stride:  Internally, this parameter affects the height and width of
  // the layers in the neural network. The lower the value of the output stride
  // the higher the accuracy but slower the speed, the higher the value the
  // faster the speed but lower the accuracy.
  input.add(guiState.input, 'outputStride', [8, 16, 32]);
  // Image scale factor: What to scale the image by before feeding it through
  // the network.
  input.add(guiState.input, 'imageScaleFactor').min(0.2).max(1.0);
  input.open();

  // Pose confidence: the overall confidence in the estimation of a person's
  // pose (i.e. a person detected in a frame)
  // Min part confidence: the confidence that a particular estimated keypoint
  // position is accurate (i.e. the elbow's position)
  let single = gui.addFolder('Single Pose Detection');
  single.add(guiState.singlePoseDetection, 'minPoseConfidence', 0.0, 1.0);
  single.add(guiState.singlePoseDetection, 'minPartConfidence', 0.0, 1.0);

  let multi = gui.addFolder('Multi Pose Detection');
  multi.add(guiState.multiPoseDetection, 'maxPoseDetections')
    .min(1)
    .max(20)
    .step(1);
  multi.add(guiState.multiPoseDetection, 'minPoseConfidence', 0.0, 1.0);
  multi.add(guiState.multiPoseDetection, 'minPartConfidence', 0.0, 1.0);
  // nms Radius: controls the minimum distance between poses that are returned
  // defaults to 20, which is probably fine for most use cases
  multi.add(guiState.multiPoseDetection, 'nmsRadius').min(0.0).max(40.0);
  multi.open();

  let output = gui.addFolder('Output');
  output.add(guiState.output, 'showVideo');
  output.add(guiState.output, 'showSkeleton');
  output.add(guiState.output, 'showPoints');
  output.add(guiState.output, 'showBoundingBox');
  output.open();


  architectureController.onChange(function (architecture) {
    guiState.changeToArchitecture = architecture;
  });

  algorithmController.onChange(function (value) {
    switch (guiState.algorithm) {
      case 'single-pose':
        multi.close();
        single.open();
        break;
      case 'multi-pose':
        single.close();
        multi.open();
        break;
    }
  });
}

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom);
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video, net) {
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');
  // since images are being fed from a webcam
  const flipHorizontal = true;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  let rightSideUpFlag = true;

  async function poseDetectionFrame() {
    if (guiState.changeToArchitecture) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();

      // Load the PoseNet model weights for either the 0.50, 0.75, 1.00, or 1.01
      // version
      guiState.net = await posenet.load(+guiState.changeToArchitecture);

      guiState.changeToArchitecture = null;
    }

    // Begin monitoring code for frames per second
    stats.begin();

    // Scale an image down to a certain factor. Too large of an image will slow
    // sdown the GPU
    const imageScaleFactor = guiState.input.imageScaleFactor;
    const outputStride = +guiState.input.outputStride;

    let poses = [];
    let minPoseConfidence;
    let minPartConfidence;
    let imageSrc = video;
    const canned = document.getElementById('canned');
    switch (guiState.image) {
      case 'webcam':
        document.body.className = 'webcam';
        break;
      default:
        console.log(guiState.image);
        document.body.className = 'canned';
        canned.crossOrigin = 'anonymous';
        canned.src = 'http://localhost:3000/' + guiState.image;
        imageSrc = canned;
        break;
    }
    switch (guiState.algorithm) {
      case 'single-pose':
        const tensor = tf.browser.fromPixels(imageSrc);
        let pose;

        if (rightSideUpFlag) {
          const pose1 = await guiState.net.estimateSinglePose(
            tensor, imageScaleFactor, flipHorizontal, outputStride);
          if (pose1.score > .5) {
            pose = pose1;
          } else {
            const pose2 = flipPoseVertically(await guiState.net.estimateSinglePose(
              tensor.reverse(0), imageScaleFactor, flipHorizontal, outputStride), imageSrc.height);
            pose = pose1.score >= pose2.score ? pose1 : pose2;
            rightSideUpFlag = pose == pose1;
          }
        } else {
          const pose2 = flipPoseVertically(await guiState.net.estimateSinglePose(
            tensor.reverse(0), imageScaleFactor, flipHorizontal, outputStride), imageSrc.height);
          if (pose2.score > .5) {
            pose = pose2;
          } else {
            const pose1 = await guiState.net.estimateSinglePose(
              tensor, imageScaleFactor, flipHorizontal, outputStride);
            pose = pose1.score >= pose2.score ? pose1 : pose2;
            rightSideUpFlag = pose == pose1;
          }
        }

        poses.push(pose);

        minPoseConfidence = +guiState.singlePoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.singlePoseDetection.minPartConfidence;
        break;
      case 'multi-pose':
        poses = await guiState.net.estimateMultiplePoses(
          video, imageScaleFactor, flipHorizontal, outputStride,
          guiState.multiPoseDetection.maxPoseDetections,
          guiState.multiPoseDetection.minPartConfidence,
          guiState.multiPoseDetection.nmsRadius);

        minPoseConfidence = +guiState.multiPoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.multiPoseDetection.minPartConfidence;
        break;
    }

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    if (guiState.output.showVideo) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-videoWidth, 0);
      ctx.drawImage(imageSrc, 0, 0, imageSrc.width, imageSrc.height);
      ctx.restore();
    }

    // For each pose (i.e. person) detected in an image, loop through the poses
    // and draw the resulting skeleton and keypoints if over certain confidence
    // scores
    poses.forEach(({ score, keypoints }) => {
      if (score >= minPoseConfidence) {
        if (guiState.output.showPoints) {
          drawKeypoints(keypoints, minPartConfidence, ctx);
          if (Math.min(keypoints[9].score, keypoints[10].score) >= minPartConfidence) {
            const kp1 = keypoints[9].position;
            const kp2 = keypoints[10].position;
            let wristD = wristDist(kp1.y, kp2.y, kp1.x, kp2.y);
            // console.log(keypoints[9].position.x) // we think this is the right wrist
            // console.log('wristD', wristD);
            let torsoCenter = getTorsoCenter(keypoints);
            // console.log(torsoCenter);
            drawPoint(ctx, torsoCenter.y, torsoCenter.x, 8, 'red');
            // console.log(openNess(keypoints))
            // console.log(upsideDown(keypoints))

            webSocket.send(wristD);
          }
        }
        if (guiState.output.showSkeleton) {
          drawSkeleton(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showBoundingBox) {
          drawBoundingBox(keypoints, ctx);
        }
      }
    });


    // End monitoring code for frames per second
    stats.end();

    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

function flipPoseVertically(pose, height) {
  return {
    score: pose.score, keypoints: pose.keypoints.map((keypoint) => {
      const { x, y } = keypoint.position;
      return { position: { x: x, y: height - 1 - y }, part: keypoint.part, score: keypoint.score };
    }),
  };
}


/**
 * compound feature functions e.g. distance between posenet left and right wrist
 */
function wristDist(leftWristX, leftWristY, rightWristX, rightWristY) {
  return Math.abs(Math.sqrt((rightWristY - leftWristY) ** 2 + (rightWristX - leftWristX) ** 2));
}

// eslint-disable-next-line no-unused-vars
function openNess(keypoints) {
  let minPoseConfidence = +guiState.singlePoseDetection.minPoseConfidence;
  let interestJoints = [0, 7, 8, 9, 10, 13, 14, 15, 16];
  let confidentJoints = interestJoints.filter((joint) => keypoints[joint].score > minPoseConfidence);
  if (confidentJoints.length == 0) return 0;
  let distances = confidentJoints.map((interestJoint) => distanceToCenter(interestJoint, keypoints));
  let radius = geometricMean(distances);
  return radius - 100;
}

function geometricMean(nums) {
  let squares = nums.map((x) => x ** 2);
  return Math.sqrt(average(squares));
}

function getTorsoCenter(keypoints) {
  let torsoPoints = [keypoints[5], keypoints[6], keypoints[11], keypoints[12]];
  return weightedCenter(torsoPoints); // at first will actually be unweighted
}

function getLegCenter(keypoints) {
  let legPoints = [keypoints[13], keypoints[14], keypoints[15], keypoints[16]];
  return weightedCenter(legPoints); // at first will actually be unweighted
}

function distanceToCenter(partID, keypoints) {
  const dx = keypoints[partID].position.x - getTorsoCenter(keypoints).x;
  const dy = keypoints[partID].position.y - getTorsoCenter(keypoints).y;
  return Math.sqrt(dx ** 2 + dy ** 2);
}

function weightedCenter(points) { // for points: returns a point not a scalar
  let xs = points.map((point) => point.position.x);
  let ys = points.map((point) => point.position.y);
  return { x: average(xs), y: average(ys) };
}

function average(nums) {
  function add(a, b) {
    return a + b;
  }
  let sum = nums.reduce(add);
  return sum / nums.length;
}

// eslint-disable-next-line no-unused-vars
function upsideDown(keypoints) {
  return legsAboveTorso(keypoints);
}

function legsAboveTorso(keypoints) {
  return getLegCenter(keypoints).y < getTorsoCenter(keypoints).y;
}

/**
 * Kicks off the demo by loading the posenet model, finding and loading
 * available camera devices, and setting off the detectPoseInRealTime function.
 */
export async function bindPage() {
  // Load the PoseNet model weights with architecture 0.75
  const net = await posenet.load(0.75);

  document.getElementById('loading').style.display = 'none';
  document.getElementById('main').style.display = 'block';

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this browser does not support video capture,' +
      'or this device does not have a camera';
    info.style.display = 'block';
    throw e;
  }


  const imageList = await fetchImageList();


  setupGui([], net, imageList);
  setupFPS();
  detectPoseInRealTime(video, net);
}

navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// kick off the demo
bindPage();
