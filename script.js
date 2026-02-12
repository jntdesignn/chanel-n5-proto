console.clear()

let ww = window.innerWidth
let wh = window.innerHeight

const isFirefox = navigator.userAgent.indexOf('Firefox') > -1
const isWindows = navigator.appVersion.indexOf("Win") != -1

const mouseMultiplier = .6
const firefoxMultiplier = 20

const multipliers = {
	mouse: isWindows ? mouseMultiplier * 2 : mouseMultiplier,
	firefox: isWindows ? firefoxMultiplier * 2 : firefoxMultiplier
}

/** POPUP **/
const popupOverlay = document.querySelector('.js-popup-overlay')
const popup = document.querySelector('.js-popup')
let popupOpen = false

function openPopup() {
	if (popupOpen) return
	popupOpen = true
	popupOverlay.classList.add('is-active')
}

function closePopup() {
	if (!popupOpen) return
	popupOpen = false
	popupOverlay.classList.remove('is-active')
}

popupOverlay.addEventListener('click', (e) => {
	if (e.target === popupOverlay) closePopup()
})

/** CORE **/
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

class Core {

	constructor() {
		this.tx = 0
		this.ty = 0
		this.cx = 0
		this.cy = 0

		this.diff = 0

		this.wheel = { x: 0, y: 0 }
		this.on = { x: 0, y: 0 }
		this.max = { x: 0, y: 0 }

		this.isDragging = false
		this.dragStart = { x: 0, y: 0 }

		this.tl = gsap.timeline({ paused: true })

		this.el = document.querySelector('.js-grid')

		/** GL specifics **/
		this.scene = new THREE.Scene()

		this.camera = new THREE.OrthographicCamera(
			ww / -2, ww / 2, wh / 2, wh / -2, 1, 1000
		)
		this.camera.lookAt(this.scene.position)
		this.camera.position.z = 1

		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
		this.renderer.setClearColor(0x000000, 0)
		this.renderer.setSize(ww, wh)
		this.renderer.setPixelRatio(
			gsap.utils.clamp(1, 1.5, window.devicePixelRatio)
		)

		document.body.appendChild(this.renderer.domElement)
		/** Gl specifics end **/

		this.addPlanes()
		this.addEvents()
		this.resize()
	}

	addEvents() {
		gsap.ticker.add(this.tick)

		window.addEventListener('mousemove', this.onMouseMove)
		window.addEventListener('mousedown', this.onMouseDown)
		window.addEventListener('mouseup', this.onMouseUp)
		window.addEventListener('wheel', this.onWheel)
	}

	addPlanes() {
		const planes = [...document.querySelectorAll('.js-plane')]

		this.planes = planes.map((el, i) => {
			const plane = new Plane()
			plane.init(el, i)

			this.scene.add(plane)

			return plane
		})
	}

	tick = () => {
		const xDiff = this.tx - this.cx
		const yDiff = this.ty - this.cy

		this.cx += xDiff * 0.085
		this.cx = Math.round(this.cx * 100) / 100

		this.cy += yDiff * 0.085
		this.cy = Math.round(this.cy * 100) / 100

		this.diff = Math.max(
			Math.abs(yDiff * 0.0001),
			Math.abs(xDiff * 0.0001)
		)

		this.planes.length
			&& this.planes.forEach(plane =>
				plane.update(this.cx, this.cy, this.max, this.diff))

		this.renderer.render(this.scene, this.camera)
	}

	onMouseMove = ({ clientX, clientY }) => {
		if (!this.isDragging || popupOpen) return

		this.tx = this.on.x + clientX * 2.5
		this.ty = this.on.y - clientY * 2.5
	}

	onMouseDown = ({ clientX, clientY }) => {
		if (this.isDragging) return

		this.isDragging = true
		this.dragStart.x = clientX
		this.dragStart.y = clientY

		this.on.x = this.tx - clientX * 2.5
		this.on.y = this.ty + clientY * 2.5
	}

	onMouseUp = ({ clientX, clientY }) => {
		if (!this.isDragging) return

		this.isDragging = false

		const dx = clientX - this.dragStart.x
		const dy = clientY - this.dragStart.y
		const dist = Math.sqrt(dx * dx + dy * dy)

		if (dist < 5 && !popupOpen) {
			mouse.x = (clientX / window.innerWidth) * 2 - 1
			mouse.y = -(clientY / window.innerHeight) * 2 + 1

			raycaster.setFromCamera(mouse, this.camera)

			const meshes = this.planes.map(p => p.mesh)
			const intersects = raycaster.intersectObjects(meshes)

			if (intersects.length > 0) {
				openPopup()
			}
		}
	}

	onWheel = (e) => {
		if (popupOpen) return

		const { mouse, firefox } = multipliers

        this.wheel.x = e.wheelDeltaX || e.deltaX * -1
		this.wheel.y = e.wheelDeltaY || e.deltaY * -1

        if (isFirefox && e.deltaMode === 1) {
            this.wheel.x *= firefox
			this.wheel.y *= firefox
        }

        this.wheel.y *= mouse
		this.wheel.x *= mouse

		this.tx += this.wheel.x
		this.ty -= this.wheel.y
	}

	resize = () => {
		ww = window.innerHeight
		wh = window.innerWidth

		const { bottom, right } = this.el.getBoundingClientRect()

		this.max.x = right
		this.max.y = bottom
	}
}

/** PLANE **/
const loader = new THREE.TextureLoader()

const vertexShader = `
precision mediump float;

uniform float u_diff;

varying vec2 vUv;

void main(){
  vec3 pos = position;

  pos.y *= 1. - u_diff;
  pos.x *= 1. - u_diff;

  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);;
}
`

const fragmentShader = `
precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_res;
uniform float u_border;

varying vec2 vUv;

void main() {
    vec2 pixel = vUv * u_res;

    if (pixel.x < u_border || pixel.x > u_res.x - u_border ||
        pixel.y < u_border || pixel.y > u_res.y - u_border) {
        gl_FragColor = vec4(1.0, 0.965, 0.91, 1.0);
    } else {
        vec2 innerUv = (pixel - vec2(u_border)) / (u_res - vec2(u_border * 2.0));
        gl_FragColor = texture2D(u_texture, innerUv);
    }
}
`

const geometry = new THREE.PlaneBufferGeometry(1, 1, 1, 1)
const material = new THREE.ShaderMaterial({
	fragmentShader,
	vertexShader,
})

class Plane extends THREE.Object3D {

	init(el, i) {
		this.el = el

		this.x = 0
		this.y = 0

		this.my = 1 - ((i % 5) * 0.1)

		this.geometry = geometry
		this.material = material.clone()

		this.material.uniforms = {
			u_texture: { value: 0 },
			u_res: { value: new THREE.Vector2(1, 1) },
			u_border: { value: 20.0 },
			u_diff: { value: 0 }
		}

		this.texture = loader.load(this.el.dataset.src, (texture) => {
			texture.minFilter = THREE.LinearFilter
			texture.generateMipmaps = false

			this.material.uniforms.u_texture.value = texture

			const { naturalWidth, naturalHeight } = texture.image
			this.imgRatio = naturalWidth / naturalHeight
			this.fitToCell()
		})

		this.mesh = new THREE.Mesh(this.geometry, this.material)
		this.add(this.mesh)

		this.resize()
	}

	update = (x, y, max, diff) => {
		const { right, bottom } = this.rect
		const { u_diff } = this.material.uniforms

		this.y = gsap.utils.wrap(
			-(max.y - bottom),
			bottom,
			y * this.my
		) - this.yOffset

		this.x = gsap.utils.wrap(
			-(max.x - right),
			right,
			x
		) - this.xOffset

		u_diff.value = diff

		this.position.x = this.x
		this.position.y = this.y
	}

	fitToCell() {
		if (!this.rect || !this.imgRatio) return

		const { width, height } = this.rect
		const cellRatio = width / height

		let w, h
		if (this.imgRatio > cellRatio) {
			w = width
			h = width / this.imgRatio
		} else {
			h = height
			w = height * this.imgRatio
		}

		const b = 20
		this.mesh.scale.set(w + b * 2, h + b * 2, 1)
		this.material.uniforms.u_res.value.set(w + b * 2, h + b * 2)
	}

	resize() {
		this.rect = this.el.getBoundingClientRect()

		const { left, top, width, height } = this.rect

		this.xOffset = (left + (width / 2)) - (ww / 2)
		this.yOffset = (top + (height / 2)) - (wh / 2)

		this.position.x = this.xOffset
		this.position.y = this.yOffset

		this.fitToCell()
	}
}

new Core()
