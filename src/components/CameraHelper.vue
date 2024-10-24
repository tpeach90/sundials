<!-- Make the focus point of the camera a bit off center on the canvas -->

<script lang="ts" setup>
import { useTresContext, useLoop} from '@tresjs/core';
import { PerspectiveCamera, Vector3} from 'three';
import { PropType, watch, defineProps, defineEmits} from 'vue';
import { extend } from '@tresjs/core'
import { OrbitControls } from 'three-stdlib';

extend({ OrbitControls })


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
    }
});

const emit = defineEmits<{
    cameraPosChange:[pos:Vector3]
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


// adjust zoom
const { onBeforeRender, pause, resume } = useLoop()
watch(() => props.zoomPerSecond, value => {
    if (value == 1) {
        pause()
    } else {
        resume()
    }
}, {immediate: true})
onBeforeRender(({ delta }) => {
    if (camera.value) {
        const zoomThisFrame = Math.pow(props.zoomPerSecond, delta)
        camera.value.position.x *= zoomThisFrame
        camera.value.position.y *= zoomThisFrame
        camera.value.position.z *= zoomThisFrame
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

</script>

<template>
    <TresOrbitControls v-if="renderer" :args="[camera, renderer?.domElement]" :enable-damping="false"
        :rotate-speed="0.5" :enable-pan="false" :target="[0,0,0]" />
</template>

