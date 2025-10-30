from numba import njit
import numpy as np
import glm
import math

# resolution
WIN_RES = glm.vec2(1200, 720)

# colors
BG_COLORS = glm.vec3(0.1, 0.16, 0.25)