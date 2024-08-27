<!-- Make the focus point of the camera a bit off center on the canvas -->

<script lang="ts" setup>
import { useTresContext } from '@tresjs/core';
import { PerspectiveCamera } from 'three';
import { PropType, watch, defineProps} from 'vue';


const {camera,  sizes} = useTresContext();

const props = defineProps({
    xOffset: {
        required: true,
        type: Number as PropType<number>
    }
});

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

</script>

<script lang="ts">

import {defineComponent} from 'vue';
export default defineComponent({
    name: "CameraOffsetHelper",
    components: {}
}) 
</script>
