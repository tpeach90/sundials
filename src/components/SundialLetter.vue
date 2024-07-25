<script setup lang="ts">
    import { TresCanvas } from '@tresjs/core';
    import { Text3D } from '@tresjs/cientos';

</script>

<template>
    <TresObject3D
        :position="position"
        :rotation="[-Math.PI/2, 0, 0]"
    >
        <Suspense>
            <Text3D
                font="/fonts/PTSerif_Regular.json"
                :size="0.2"
                :bevel-enabled="false"
                :height="0.05"
                :cast-shadow="castShadow"
                :receive-shadow="receiveShadow"
            >
                {{ text }}
                <TresMeshPhongMaterial
                    color="#737373"
                />
            </Text3D>
        </Suspense>
    </TresObject3D>
</template>


<script lang="ts">
    import { Prop, PropType, defineComponent } from 'vue'
    export default defineComponent({
        props:{
            text: {
                required: true,
                type: String as PropType<string>
            },
            position: {
                required:true,
                type: Array as PropType<number[]>, 
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
            }
        }
    })
</script>