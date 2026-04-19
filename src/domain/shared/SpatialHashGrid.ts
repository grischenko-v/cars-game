export interface SpatialItem {
  x: number
  z: number
}

export class SpatialHashGrid<T extends SpatialItem> {
  private readonly cells = new Map<string, T[]>()

  constructor(private readonly cellSize: number) {}

  insert(item: T): void {
    const key = this.keyFor(item.x, item.z)
    const cell = this.cells.get(key)

    if (cell) {
      cell.push(item)
    } else {
      this.cells.set(key, [item])
    }
  }

  queryRadius(x: number, z: number, radius: number): T[] {
    const minCellX = Math.floor((x - radius) / this.cellSize)
    const maxCellX = Math.floor((x + radius) / this.cellSize)
    const minCellZ = Math.floor((z - radius) / this.cellSize)
    const maxCellZ = Math.floor((z + radius) / this.cellSize)
    const result: T[] = []

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
        const cell = this.cells.get(this.key(cellX, cellZ))
        if (cell) result.push(...cell)
      }
    }

    return result
  }

  private keyFor(x: number, z: number): string {
    return this.key(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize))
  }

  private key(cellX: number, cellZ: number): string {
    return `${cellX}:${cellZ}`
  }
}
