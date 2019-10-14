# PoseNet Demos

[Modified by OWS, MM May June 2019]

## Contents

### Demo 1: Camera

The camera demo shows how to estimate poses in real-time from a webcam video stream.

<img src="https://raw.githubusercontent.com/irealva/tfjs-models/master/posenet/demos/camera.gif" alt="cameraDemo" style="width: 600px;"/>

## Setup

Install dependencies and prepare the build directory:

```sh
yarn
```

## Running

Run the API server in one terminal window:

```shell
yarn api-server
```

In another terminal window, run the web server:

```shell
yarn watch
```

The web server will be running at <http://localhost:1234>.

## References

[PoseNet online documentation](https://github.com/tensorflow/tfjs-models/tree/master/posenet)

### Keypoints

All keypoints are indexed by part id. The parts and their ids are:

| Id  | Part          |
| --- | ------------- |
| 0   | nose          |
| 1   | leftEye       |
| 2   | rightEye      |
| 3   | leftEar       |
| 4   | rightEar      |
| 5   | leftShoulder  |
| 6   | rightShoulder |
| 7   | leftElbow     |
| 8   | rightElbow    |
| 9   | leftWrist     |
| 10  | rightWrist    |
| 11  | leftHip       |
| 12  | rightHip      |
| 13  | leftKnee      |
| 14  | rightKnee     |
| 15  | leftAnkle     |
| 16  | rightAnkle    |
