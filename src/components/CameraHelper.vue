<!-- Make the focus point of the camera a bit off center on the canvas -->

<script lang="ts" setup>
import { useTresContext, useLoop} from '@tresjs/core';
import { Euler, OrthographicCamera, PerspectiveCamera, Plane, Quaternion, Vector3} from 'three';
import { PropType, watch, defineProps, defineEmits, ref } from 'vue';
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
    // cameraPosChange:[pos:Vector3],
    cameraQuaternionChange:[quaternion:Quaternion]
    onAdvanceTime: [mins: number]
}>()


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


// start/stop render loop
const { onBeforeRender, onAfterRender, pause, resume } = useLoop()
watch(() => [props.zoomPerSecond, props.timeAdvanceSpeed], () => {
    if (props.zoomPerSecond != 1 || props.timeAdvanceSpeed != 0) {
        resume()
    } else {
        pause()
    }
}, {immediate: true})


let leftoverMinFractionFromLastFrame = ref<number>(0)

onBeforeRender(({ delta }) => {
    // adjust zoom
    if (camera.value && props.zoomPerSecond != 1) {
        const zoomThisFrame = Math.pow(props.zoomPerSecond, delta)
        if (props.lockCamera) {
            let c = (camera.value as OrthographicCamera);
            if (c.isOrthographicCamera) {
                c.zoom /= zoomThisFrame
                controls2d.update()
            }
        } else {
            camera.value.position.multiplyScalar(zoomThisFrame)
        }
    }

    // adjust sundial time
    if (props.timeAdvanceSpeed != 0) {
        const fractionalMinsToAdd = delta * props.timeAdvanceSpeed / 70 * 1000 + leftoverMinFractionFromLastFrame.value
        const wholeMins = Math.floor(fractionalMinsToAdd)
        leftoverMinFractionFromLastFrame.value = fractionalMinsToAdd % 1
        if (wholeMins > 0) {
            emit('onAdvanceTime', wholeMins)
        }
    }
})




watch(() => [
    camera.value?.position.x,
    camera.value?.position.y,
    camera.value?.position.z,
], () => {
    if (camera.value) {
        // I think this is necessary because we're adding the controls outside of tresjs
        invalidate()
    }
}, {immediate: true})

watch(() => [
    camera.value?.quaternion.w,
    camera.value?.quaternion.x,
    camera.value?.quaternion.y,
    camera.value?.quaternion.z,
], () => {
    if (camera.value) {
        emit("cameraQuaternionChange", camera.value.quaternion.clone())
    }
}, {immediate: true})


const camHeight2d = 5


const oldSundialRotation = ref<Euler>();
let controls3d: OrbitControls;
let controls2d: MapControls;

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

// create the controls when each camera is first active
// dont use the extend({OrbitControls}) + <TresOrbitControls/> pattern because I can't find a way to call update()
watch(() => [renderer.value, camera.value, props.lockCamera], () => {
    if (!controls3d && renderer.value && camera.value && !props.lockCamera) {
        camera.value?.position.set(7, 7, 7);
        controls3d = new OrbitControls((camera.value) as PerspectiveCamera, renderer.value.domElement)
        controls3d.target = props.target
        controls3d.enableDamping = false;
        controls3d.rotateSpeed = 0.5
        controls3d.enablePan = false
        controls3d.enabled = !props.lockCamera
        controls3d.update()
    }
    if (!controls2d && renderer.value && camera.value && props.lockCamera) {

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



// move orthographic camera when sundial rotation changes
// do this by comparing the new rotation to the old rotation
watch(() => [props.sundialRotation, props.lockCamera], () => {
    if (controls2d && camera.value && oldSundialRotation.value && props.lockCamera) {

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

</script>

