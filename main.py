import pygame
from pygame.locals import DOUBLEBUF, OPENGL
from OpenGL.GL import *

def main():
    pygame.init()

    pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MAJOR_VERSION, 3)
    pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MINOR_VERSION, 3)
    pygame.display.gl_set_attribute(pygame.GL_CONTEXT_PROFILE_MASK, pygame.GL_CONTEXT_PROFILE_CORE)

    screen_width = 1200
    screen_height = 720
    screen = pygame.display.set_mode((screen_width, screen_height), OPENGL | DOUBLEBUF)

    pygame.display.set_caption('SolarCraft')

    glClearColor(0.6, 0.78, 0.76, 1.0)

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                running = False

        glClear(GL_COLOR_BUFFER_BIT)
        pygame.display.flip()

    pygame.quit()

if __name__ == '__main__':
    main()