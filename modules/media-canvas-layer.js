import constants from './settings/constants.js'
import { findBoundingTileByName } from './helpers.js'

/**
 * Create a dedicated layer for sharing a media on a scene
 */
class ShareMediaLayer extends CanvasLayer {
    constructor() {
        super()
        this.containers = []
    }

    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, {
            canDragCreate: false,
            zIndex: 10,
            name: constants.moduleName
        })
    }

    /**
     * Create a sprite on the scene bounded by a tile and a style
     */
    async createBoundedSprite(boundingTileName, url, style, isVideo = false, loop = false, mute = true) {
        const boundingTile = findBoundingTileByName(boundingTileName)
        if (!boundingTile) { return }

        const container = this._prepareContainer(boundingTileName, boundingTile.data.z)

        const sprite = await this._createSprite(url, isVideo, boundingTile, loop, mute)

        const spriteScaleFactor = style === 'fit' ?
            this._calculateScaleFactorFit(sprite.width, sprite.height, boundingTile.data.width, boundingTile.data.height) :
            this._calculateScaleFactorCover(sprite.width, sprite.height, boundingTile.data.width, boundingTile.data.height)
        sprite.scale.set(spriteScaleFactor)

        const spriteCoordinates = this._calculateAspectRatioCoordinates(boundingTile.data.x, boundingTile.data.y, boundingTile.data.width, boundingTile.data.height, sprite.width, sprite.height)
        sprite.position.set(spriteCoordinates.x, spriteCoordinates.y)

        if (style === 'cover') {
            this._addMask(container, boundingTile.data.x, boundingTile.data.y, boundingTile.data.width, boundingTile.data.height)
        }

        container.addChild(sprite)
    }

    /**
     * Delete a sprite on the scene by container parentName
     */
    deleteBoundedSprite(parentName) {
        this.containers = this.containers.filter(c => {
            if (c.parentName === parentName) {
                c.destroy(true)
            }

            return c.parentName !== parentName
        })
    }

    /**
     * (Re)Create a PIXI container
     */
    _prepareContainer(name, zIndex) {
        this.deleteBoundedSprite(name)

        const container = new PIXI.Container()
        container.sortableChildren = true
        container.parentName = name
        container.zIndex = zIndex
        this.containers.push(container)
        this.addChild(container)
        this.sortChildren()

        return container
    }

    /**
     * Add a mask to the current container
     */
    _addMask(container, x, y, width, height) {
        const mask = new PIXI.Graphics()
            .beginFill(0xFF3300)
            .drawRect(x, y, width, height)
            .endFill()

        container.mask = mask
        container.addChild(mask)
    }

    /**
     * Create a sprite from a texture and an url
     */
    async _createSprite(url, isVideo, boundingTile, loop = false, mute = true) {
        const texture = await loadTexture(url)
        const sprite = new PIXI.Sprite(texture)

        if (isVideo) {
            if (game.user.isGM) {
                sprite.texture.baseTexture.resource.source.addEventListener('ended', () => {
                    if (!loop) boundingTile.parent.unsetFlag(constants.moduleName, boundingTile.data.flags[constants.moduleName].name)
                })
            }

            sprite.texture.baseTexture.resource.source.loop = loop
            sprite.texture.baseTexture.resource.source.muted = mute

            sprite.texture.baseTexture.resource.source.play().catch(e => {
                sprite.texture.baseTexture.resource.source.muted = true
                sprite.texture.baseTexture.resource.source.play()
            })
        }

        return sprite
    }

    /**
     * Calculate the scaling factor of a rectangle withing another rectangle (fit)
     */
    _calculateScaleFactorFit(srcWidth, srcHeight, maxWidth, maxHeight) {
        const srcRatio = srcWidth / srcHeight
        const maxRatio = maxWidth / maxHeight

        return maxRatio > srcRatio ? maxHeight / srcHeight : maxWidth / srcWidth
    }

    /**
     * Calculate the scaling factor of a rectangle withing another rectangle (cover)
     */
    _calculateScaleFactorCover(srcWidth, srcHeight, maxWidth, maxHeight) {
        const srcRatio = srcWidth / srcHeight
        const maxRatio = maxWidth / maxHeight

        return maxRatio > srcRatio ? maxWidth / srcWidth : maxHeight / srcHeight
    }

    /**
     * Calculate the coordinates respecting the aspect ratio of rectangle withing another rectangle
     */
    _calculateAspectRatioCoordinates(srcX, srcY, srcWidth, srcHeight, targetWidth, targetHeight) {
        return {
            x: (srcX + srcWidth / 2) - (targetWidth / 2),
            y: (srcY + srcHeight / 2) - (targetHeight / 2)
        }
    }
}

/**
 * Register the media sharing canvas layer
 */
export default function registerCanvasLayer() {
    CONFIG.Canvas.layers.shareMedia = { layerClass: ShareMediaLayer, group: 'primary' }
}