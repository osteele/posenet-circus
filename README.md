# PoseNet Experiments

This is a platform for experimenting with PoseNet. The code is adapted from the
tensorflow PosetNet demo at
[@tensorflow/tfjs-models](https://github.com/tensorflow/tfjs-models/tree/master/posenet).
It adds:

- The option to select and operate on a static image from a directory.
- Extracts a feature, and sends it to an API server where it is relayed to OSC.
- Images are considered both rightside up and upside down. This is an attempt to
  recognize people doing circus activities.

## Setup

Install dependencies and prepare the build directory:

```shell
yarn install
```

## Running

Run the web server and the API server:

```shell
yarn start
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
