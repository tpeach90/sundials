<!-- Make the focus point of the camera a bit off center on the canvas -->

<script lang="ts" setup>
import { useTresContext, useLoop} from '@tresjs/core';
import { PerspectiveCamera, Vector3} from 'three';
import { PropType, watch, defineProps, defineEmits, ref} from 'vue';
import { OrbitControls } from 'three-stdlib';


const {camera,  sizes, renderer, invalidate} = useTresContext();

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
    }
});

const emit = defineEmits<{
    cameraPosChange:[pos:Vector3],
    onAdvanceTime: [mins: number]
}>()



// Make the focus point of the camera a bit off center on the canvas
watch(() => [sizes.width.value, sizes.height.value, props.xOffset], () => {
    const zoomMultiple = (sizes.width.value + Math.abs(props.xOffset) * 2) / sizes.width.value;
    if ((camera.value as PerspectiveCamera | undefined)?.isPerspectiveCamera) {
        (camera.value as PerspectiveCamera).setViewOffset(
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


// create the controls
// dont use the extend({OrbitControls}) + <TresOrbitControls/> pattern because I can't find a way to call update()
let controls: OrbitControls;
watch(() => [renderer.value, camera.value], () => {
    if (!controls && renderer.value && camera.value) {
        camera.value?.position.set(7, 7, 7);
        controls = new OrbitControls((camera.value) as PerspectiveCamera, renderer.value.domElement)
        controls.target = props.target
        controls.enableDamping = false;
        controls.rotateSpeed = 0.5
        controls.enablePan = false
        controls.update()
    }
}, {immediate:true})

</script>

