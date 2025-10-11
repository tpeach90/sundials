<!-- Make the focus point of the camera a bit off center on the canvas -->

<script lang="ts" setup>
import { useTresContext, useLoop} from '@tresjs/core';
import { Euler, OrthographicCamera, PerspectiveCamera, Plane, Quaternion, Vector3} from 'three';
import { PropType, watch, defineProps, defineEmits, ref, computed} from 'vue';
import { OrbitControls, MapControls } from 'three-stdlib';
import { infiniteLineIntersectWithPlane } from '@/calculations';


const {camera,  sizes, renderer, invalidate, cameras, setCameraActive} = useTresContext();

const props = defineProps({
    xOffset: {
        required: true,
        type: Number as PropType<number>
    },
    zoomPerSecond : {
        required: false,
        default:1,
        type: Number as PropType<number>
    },
    timeAdvanceSpeed: {
        required: true,
        type: Number as PropType<number>
    },
    target: {
        required: true,
        type: Object as PropType<Vector3>
    },
    sundialRotation: {
        required: true,
        type: Object as PropType<Euler>
    },
    sundialOrigin: {
        required: true,
        type: Object as PropType<Vector3>
    },
    lockCamera: {
        required: true,
        type: Boolean as PropType<boolean>
    }
});

const emit = defineEmits<{
    cameraPosChange:[pos:Vector3],
    onAdvanceTime: [mins: number]
}>()

const cameraType = computed(() => {
    if ((camera.value as PerspectiveCamera | undefined)?.isPerspectiveCamera) return "3d"
    if ((camera.value as OrthographicCamera | undefined)?.isOrthographicCamera) return "2d"
    return undefined
})



// Make the focus point of the camera a bit off center (horizontal) on the canvas
// because of the sidebar
watch(() => [sizes.width.value, sizes.height.value, props.xOffset, camera.value], () => {
    const zoomMultiple = (sizes.width.value + Math.abs(props.xOffset) * 2) / sizes.width.value;
    if (camera.value) {
        (camera.value as PerspectiveCamera | OrthographicCamera).setViewOffset(
            sizes.width.value * zoomMultiple,
            sizes.height.value * zoomMultiple,
            props.xOffset > 0 ? props.xOffset * 2 : 0,
            sizes.height.value * (zoomMultiple - 1) / 2,
            sizes.width.value,
            sizes.height.value);
    }
}, {immediate: true})



const { onBeforeRender, onAfterRender, pause, resume } = useLoop()
watch(() => [props.zoomPerSecond, props.timeAdvanceSpeed], () => {
    if (props.zoomPerSecond != 1 || props.timeAdvanceSpeed != 0) {
        resume()
    } else {
        pause()
    }
}, {immediate: true})
// adjust zoom
onBeforeRender(({ delta }) => {
    if (camera.value && props.zoomPerSecond != 1) {
        const zoomThisFrame = Math.pow(props.zoomPerSecond, delta)
        camera.value.position.x *= zoomThisFrame
        camera.value.position.y *= zoomThisFrame
        camera.value.position.z *= zoomThisFrame
    }
})
// adjust sundial time
let leftoverMinFractionFromLastFrame = ref<number>(0)
onAfterRender(({ delta }) => {
    const fractionalMinsToAdd = delta * props.timeAdvanceSpeed / 70 * 1000 + leftoverMinFractionFromLastFrame.value
    const wholeMins = Math.floor(fractionalMinsToAdd)
    leftoverMinFractionFromLastFrame.value = fractionalMinsToAdd % 1
    if (wholeMins > 0) {
        emit('onAdvanceTime', wholeMins)
    }
})

watch(() => [
    camera.value?.position.x,
    camera.value?.position.y,
    camera.value?.position.z,
], () => {
    if (camera.value) {
        invalidate()
        emit("cameraPosChange", camera.value.position.clone())
    }
}, {immediate: true})


const camHeight2d = 10

// create the controls
// dont use the extend({OrbitControls}) + <TresOrbitControls/> pattern because I can't find a way to call update()
const oldSundialRotation = ref<Euler>();
let controls3d: OrbitControls;
let controls2d: MapControls;
watch(() => [renderer.value, camera.value, cameraType.value], () => {
    if (!controls3d && renderer.value && camera.value && cameraType.value == "3d") {
        camera.value?.position.set(7, 7, 7);
        controls3d = new OrbitControls((camera.value) as PerspectiveCamera, renderer.value.domElement)
        controls3d.target = props.target
        controls3d.enableDamping = false;
        controls3d.rotateSpeed = 0.5
        controls3d.enablePan = false
        controls3d.enabled = !props.lockCamera
        controls3d.update()
    }
    if (!controls2d && renderer.value && camera.value && cameraType.value == "2d") {

        // cam position
        const sundialNormal = new Vector3(0, 1, 0).applyEuler(props.sundialRotation)
        const camPosition = props.sundialOrigin.clone().add(sundialNormal.clone().multiplyScalar(camHeight2d))
        camera.value.position.set(camPosition.x, camPosition.y, camPosition.z)
        camera.value.up.set(...new Vector3(0, 0, -1).applyEuler(props.sundialRotation).toArray())
        // cast to prevent ts errors
        let c = (camera.value as OrthographicCamera); 
        c.zoom = 0.07 * window.innerHeight

        controls2d = new MapControls(camera.value as OrthographicCamera, renderer.value.domElement)
        controls2d.target.set(...props.sundialOrigin.toArray())
        controls2d.enableDamping = false
        controls2d.screenSpacePanning = true
        controls2d.zoomToCursor = true
        controls2d.enabled = props.lockCamera
        controls2d.update()

        oldSundialRotation.value = props.sundialRotation.clone()
    }
}, {immediate:true})

// switch between cameras
watch(() => [props.lockCamera, cameras], () => {

    if (controls2d) controls2d.enabled = props.lockCamera
    if (controls3d) controls3d.enabled = !props.lockCamera

    for (let cam of cameras.value) {
        if ((props.lockCamera && (cam as OrthographicCamera).isOrthographicCamera) ||
            (!props.lockCamera && (cam as PerspectiveCamera).isPerspectiveCamera)) {
            setCameraActive(cam.uuid)
            return
        }
    }
}, { immediate: true })

// move orthographic camera when sundial rotation changes
// do this by comparing the new rotation to the old rotation
watch(() => [props.sundialRotation, cameraType.value], () => {
    if (controls2d && camera.value && oldSundialRotation.value && cameraType.value == "2d") {

        console.log(oldSundialRotation.value, props.sundialRotation)
        const oldNormal = new Vector3(0, 1, 0).applyEuler(oldSundialRotation.value)
        const oldPlane = new Plane(oldNormal, 0).translate(props.sundialOrigin);
        const newTarget = infiniteLineIntersectWithPlane(oldPlane, camera.value.position, camera.value.getWorldDirection(new Vector3()))
            // move sundial to (0,0,0)
            ?.sub(props.sundialOrigin)
            // un-apply old sundial rotation
            .applyQuaternion(new Quaternion().setFromEuler(oldSundialRotation.value).invert())
            // set y coord to 0 to cancel inaccuracies
            .setComponent(1, 0)
            // apply new sundial rotation
            .applyEuler(props.sundialRotation)
            // re-apply sundial origin
            .add(props.sundialOrigin)
        if (!newTarget) return
        const newNormal = new Vector3(0, 1, 0).applyEuler(props.sundialRotation)
        const newPosition = newTarget.clone().add(newNormal.clone().multiplyScalar(camHeight2d))

        controls2d.target.set(...newTarget.toArray())
        camera.value.position.set(...newPosition.toArray())
        camera.value.up.set(...new Vector3(0, 0, -1).applyEuler(props.sundialRotation).toArray())
        controls2d.update()
        
        oldSundialRotation.value = props.sundialRotation.clone()
    }

})

// watch(() => [camera.value?.position.toArray()], () => {
//     console.log(camera.value?.position.toArray())
// })

</script>

