import * as THREE from 'three'

const textureLoader = new THREE.TextureLoader()

export interface PbrTextureSet {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

export function loadRepeatingPbrTextures(
  basePath: string,
  name: string,
  repeatX: number,
  repeatY: number
): PbrTextureSet {
  const map = loadTexture(`${basePath}/${name}_Color.jpg`, repeatX, repeatY)
  const normalMap = loadTexture(`${basePath}/${name}_NormalGL.jpg`, repeatX, repeatY)
  const roughnessMap = loadTexture(`${basePath}/${name}_Roughness.jpg`, repeatX, repeatY)

  map.colorSpace = THREE.SRGBColorSpace

  return { map, normalMap, roughnessMap }
}

function loadTexture(path: string, repeatX: number, repeatY: number): THREE.Texture {
  const texture = textureLoader.load(path)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = 8
  return texture
}
