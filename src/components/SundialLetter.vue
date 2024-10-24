<!-- Letter displayed on the sundial plate. -->

<script setup lang="ts">

import { Text3D } from '@tresjs/cientos';
import { PropType, computed, defineProps } from 'vue'
import { Vector3, Vector3Tuple } from "three";
const props = defineProps({
    text: {
        required: true,
        type: String as PropType<string>
    },
    position: {
        required: true,
        type: Object as PropType<Vector3 | Vector3Tuple>,
    },
    castShadow: {
        required: false,
        default: false,
        type: Boolean as PropType<boolean>
    },
    receiveShadow: {
        required: false,
        default: false,
        type: Boolean as PropType<boolean>
    },
    size: {
        required: false,
        default: 0.2,
        type: Number as PropType<number>
    }
})

const visible = computed(() => props.text != '')
const textHeight = computed(() => 0.03 * props.size/0.2)
const rotation = [-Math.PI/2, 0, 0] as [number, number, number]

</script>

<template>
    <TresObject3D
        :position="position"
        :rotation="rotation"
        :visible="visible"
    >
        <Suspense>
            <Text3D
                font="./fonts/PTSerif_Regular_Only_Numerals.json"
                :size="size"
                :bevel-enabled="false"
                :height="textHeight"
                :cast-shadow="castShadow"
                :receive-shadow="receiveShadow"
                need-updates
                center
            >
                {{ text }}
                <TresMeshPhongMaterial
                    color="#737373"
                />
            </Text3D>
        </Suspense>
    </TresObject3D>
</template>
