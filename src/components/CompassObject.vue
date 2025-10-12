<script setup lang="ts">
import { GLTFModel } from '@tresjs/cientos';
import {defineProps, PropType, computed} from 'vue';
import {Euler, Quaternion} from 'three';

/**
 * Note: assuming that compass camera is looking in the negative Z direction
 */

const props = defineProps({
    sundialCameraQuaternion: {
        required: false,
        type: Object as PropType<Quaternion>
    }
})

const constCompassQuaternion = new Quaternion().setFromEuler(new Euler(0, Math.PI, 0, "XYZ"))

const quaternion = computed(() => {
    if (!props.sundialCameraQuaternion) return new Quaternion()
    return props.sundialCameraQuaternion.clone().invert()
        .multiply(constCompassQuaternion)
})

</script>

<template>
    <TresObject3D :quaternion="quaternion">
        <Suspense>
            <GLTFModel path="./objects3d/compass.glb" />
        </Suspense>
    </TresObject3D>
</template>