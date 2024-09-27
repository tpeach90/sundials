<!-- Letter displayed on the sundial plate. -->

<template>
    <TresObject3D
        :position="position"
        :rotation="[-Math.PI/2, 0, 0]"
        :visible="text != ''"
    >
        <Suspense>
            <Text3D
                font="./fonts/PTSerif_Regular_Only_Numerals.json"
                :size="0.2"
                :bevel-enabled="false"
                :height="0.05"
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


<script lang="ts">
    import { Text3D } from '@tresjs/cientos';
    import {  PropType, defineComponent } from 'vue'
    import {Vector3, Vector3Tuple} from "three";
    export default defineComponent({
        name:"SundialLetter",
        props:{
            text: {
                required: true,
                type: String as PropType<string>
            },
            position: {
                required:true,
                type: Object as PropType<Vector3|Vector3Tuple>, 
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
        },
        components:{Text3D}
    })
</script>