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

export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}${path.replace(/^\/+/, '')}`
}

function loadTexture(path: string, repeatX: number, repeatY: number): THREE.Texture {
  const texture = textureLoader.load(publicAssetUrl(path))
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = 8
  return texture
}
