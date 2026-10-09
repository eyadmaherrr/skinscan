/**
 * Landmark indices of the MediaPipe Face Mesh V2 topology (478 points: 468
 * mesh points + 10 iris points). Index lists follow the contours published
 * with MediaPipe (face_mesh_connections). "Image-left" means the side of the
 * face that appears on the left of a non-mirrored photo (the person's right).
 */

export const LANDMARK_COUNT = 478;

export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150,
  136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/** Image-left eye contour: lower lid (outer→inner) then upper lid (inner→outer). */
export const EYE_IMG_LEFT = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const EYE_IMG_RIGHT = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
export const LOWER_LID_IMG_LEFT = [33, 7, 163, 144, 145, 153, 154, 155, 133];
export const LOWER_LID_IMG_RIGHT = [263, 249, 390, 373, 374, 380, 381, 382, 362];

/** Brows: upper edge (outer→inner) and lower edge (outer→inner). */
export const BROW_UPPER_IMG_LEFT = [70, 63, 105, 66, 107];
export const BROW_LOWER_IMG_LEFT = [46, 53, 52, 65, 55];
export const BROW_UPPER_IMG_RIGHT = [300, 293, 334, 296, 336];
export const BROW_LOWER_IMG_RIGHT = [276, 283, 282, 295, 285];

export const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

/** Forehead top arc of the face oval, image-left → image-right. */
export const FOREHEAD_ARC = [54, 103, 67, 109, 10, 338, 297, 332, 284];

export const LM = {
  noseTip: 1,
  noseBridge: 168,
  foreheadTop: 10,
  chin: 152,
  upperLipTop: 0,
  lowerLipBottom: 17,
  upperLipInner: 13,
  lowerLipInner: 14,
  mouthCornerImgLeft: 61,
  mouthCornerImgRight: 291,
  eyeOuterImgLeft: 33,
  eyeInnerImgLeft: 133,
  eyeInnerImgRight: 362,
  eyeOuterImgRight: 263,
  faceSideImgLeft: 234,
  faceSideImgRight: 454,
  /** Iris centres (refined landmarks 468–477). */
  irisImgLeft: 468,
  irisImgRight: 473,
  /** Anatomical v3 anchors */
  glabella: 9,
  subnasale: 2,
  infratip: 4,
  labiomentalCrease: 18,
  leftAlarBase: 102,
  rightAlarBase: 331,
  leftBrowInner: 107,
  rightBrowInner: 336,
  leftBrowOuter: 70,
  rightBrowOuter: 300,
} as const;

/** Iris ring points (4 per eye) around the centres above. */
export const IRIS_RING_IMG_LEFT = [469, 470, 471, 472];
export const IRIS_RING_IMG_RIGHT = [474, 475, 476, 477];

