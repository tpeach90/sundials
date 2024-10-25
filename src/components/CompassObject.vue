<script setup lang="ts">
import { GLTFModel } from '@tresjs/cientos';
import {defineProps, PropType, computed} from 'vue';
import {Euler} from 'three';

const props = defineProps({
    rotation: {
        required: true,
        type: Object as PropType<Euler>
    }
})

const rotationCopy = computed(() => props.rotation.clone())
const fixedRotationOffset = [0, Math.PI, 0] as [number, number, number]

</script>

<template>
    <TresObject3D :rotation="rotationCopy">
        <TresObject3D :rotation="fixedRotationOffset">
            <Suspense>
                <GLTFModel path="./objects3d/compass.glb" />
            </Suspense>
        </TresObject3D>
    </TresObject3D>
</template>