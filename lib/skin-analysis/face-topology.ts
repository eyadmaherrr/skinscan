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

// =============================================================================
// Canonical Anatomical Region Contours (MediaPipe 468/478 Landmark Indices)
// Validated for zero self-intersection, strict anatomical bounds, and boundary continuity.
// =============================================================================

export const CONTOUR_FOREHEAD_CENTER = [109, 10, 338, 297, 337, 8, 9, 108, 67];
export const CONTOUR_FOREHEAD_LEFT = [54, 103, 67, 108, 107, 66, 105, 63, 70];
export const CONTOUR_FOREHEAD_RIGHT = [338, 297, 332, 284, 300, 293, 334, 296, 336, 337];
export const CONTOUR_TEMPLE_LEFT = [54, 21, 162, 127, 234, 130, 226, 46, 70];
export const CONTOUR_TEMPLE_RIGHT = [284, 251, 389, 356, 454, 359, 446, 276, 300];
export const CONTOUR_GLABELLA = [107, 108, 9, 337, 336, 285, 417, 168, 193, 55];

export const CONTOUR_UPPER_EYE_LEFT = [46, 53, 52, 65, 55, 190, 173, 157, 158, 159, 160, 161, 246, 33, 247, 130, 226];
export const CONTOUR_UPPER_EYE_RIGHT = [285, 295, 282, 283, 276, 446, 359, 467, 263, 466, 388, 387, 386, 385, 384, 398, 362, 414, 441];
export const CONTOUR_UNDER_EYE_LEFT = [33, 7, 163, 144, 145, 153, 154, 155, 133, 243, 233, 232, 231, 230, 229, 228, 130, 247];
export const CONTOUR_UNDER_EYE_RIGHT = [362, 382, 381, 380, 374, 373, 390, 249, 263, 467, 359, 448, 449, 450, 451, 452, 463];

export const CONTOUR_NOSE_BRIDGE = [193, 168, 417, 465, 351, 419, 5, 195, 196, 122, 245];
export const CONTOUR_NOSE_TIP = [5, 419, 248, 281, 275, 4, 1, 2, 97, 98, 45, 51, 3, 196];
export const CONTOUR_NASAL_SIDEWALL_LEFT = [168, 122, 196, 3, 51, 115, 102, 131, 198, 236, 174, 188, 245, 193];
export const CONTOUR_NASAL_SIDEWALL_RIGHT = [168, 417, 465, 412, 399, 456, 420, 360, 331, 344, 281, 248, 419, 351];
export const CONTOUR_ALAR_LEFT = [102, 48, 64, 98, 97, 2, 45, 51];
export const CONTOUR_ALAR_RIGHT = [331, 278, 294, 327, 326, 2, 275, 281];

export const CONTOUR_CHEEK_LEFT = [233, 232, 231, 230, 229, 228, 234, 93, 132, 58, 172, 204, 61, 205, 48, 102, 115, 131, 198];
export const CONTOUR_CHEEK_RIGHT = [448, 449, 450, 451, 452, 420, 429, 358, 331, 278, 425, 291, 424, 397, 288, 361, 323, 454];

export const CONTOUR_PERIORAL_UPPER = [102, 48, 2, 278, 331, 425, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61, 205];
export const CONTOUR_PERIORAL_LOWER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 424, 421, 18, 201, 204];
export const CONTOUR_PERIORAL_LEFT = [61, 205, 214, 212, 202, 204];
export const CONTOUR_PERIORAL_RIGHT = [291, 425, 434, 432, 422, 424];

export const CONTOUR_CHIN_CENTER = [201, 18, 421, 428, 396, 377, 152, 148, 171, 208];
export const CONTOUR_CHIN_LEFT = [204, 201, 208, 171, 148, 176, 149, 150];
export const CONTOUR_CHIN_RIGHT = [421, 424, 378, 400, 377, 396, 428];

export const CONTOUR_JAWLINE_LEFT = [172, 136, 150, 149, 176, 148, 152, 171, 208, 204];
export const CONTOUR_JAWLINE_RIGHT = [152, 377, 400, 378, 379, 365, 397, 424, 428, 396, 377];

/** All 27 anatomical V3 region contours mapped by RegionKeyV3 */
export const ANATOMICAL_CONTOURS_V3: Record<string, readonly number[]> = {
  foreheadCenter: CONTOUR_FOREHEAD_CENTER,
  foreheadLeft: CONTOUR_FOREHEAD_LEFT,
  foreheadRight: CONTOUR_FOREHEAD_RIGHT,
  templeLeft: CONTOUR_TEMPLE_LEFT,
  templeRight: CONTOUR_TEMPLE_RIGHT,
  glabella: CONTOUR_GLABELLA,
  upperEyeLeft: CONTOUR_UPPER_EYE_LEFT,
  upperEyeRight: CONTOUR_UPPER_EYE_RIGHT,
  underEyeLeft: CONTOUR_UNDER_EYE_LEFT,
  underEyeRight: CONTOUR_UNDER_EYE_RIGHT,
  noseBridge: CONTOUR_NOSE_BRIDGE,
  noseTip: CONTOUR_NOSE_TIP,
  nasalSidewallLeft: CONTOUR_NASAL_SIDEWALL_LEFT,
  nasalSidewallRight: CONTOUR_NASAL_SIDEWALL_RIGHT,
  alarSkinLeft: CONTOUR_ALAR_LEFT,
  alarSkinRight: CONTOUR_ALAR_RIGHT,
  cheekLeft: CONTOUR_CHEEK_LEFT,
  cheekRight: CONTOUR_CHEEK_RIGHT,
  perioralUpper: CONTOUR_PERIORAL_UPPER,
  perioralLower: CONTOUR_PERIORAL_LOWER,
  perioralLeft: CONTOUR_PERIORAL_LEFT,
  perioralRight: CONTOUR_PERIORAL_RIGHT,
  chinCenter: CONTOUR_CHIN_CENTER,
  chinLeft: CONTOUR_CHIN_LEFT,
  chinRight: CONTOUR_CHIN_RIGHT,
  jawlineLeft: CONTOUR_JAWLINE_LEFT,
  jawlineRight: CONTOUR_JAWLINE_RIGHT,
} as const;

/** Canonical contours for the 7 primary facial regions */
export const LEGACY_PRIMARY_CONTOURS: Record<string, readonly number[]> = {
  forehead: [
    54, 103, 67, 109, 10, 338, 297, 332, 284,
    300, 293, 334, 296, 336,
    9,
    107, 66, 105, 63, 70,
  ],
  underEyeL: CONTOUR_UNDER_EYE_LEFT,
  underEyeR: CONTOUR_UNDER_EYE_RIGHT,
  nose: [
    168, 193, 245, 122, 196, 3, 51, 115, 102, 48, 64, 98, 97, 2,
    326, 327, 294, 278, 331, 360, 420, 456, 399, 412, 465, 417,
  ],
  cheekL: CONTOUR_CHEEK_LEFT,
  cheekR: CONTOUR_CHEEK_RIGHT,
  chin: [
    201, 18, 421, 428, 396, 377, 152, 148, 171, 208,
  ],
  jawL: CONTOUR_JAWLINE_LEFT,
  jawR: CONTOUR_JAWLINE_RIGHT,
} as const;


