Shader "Coco/RimWrap/Basic(lipgloss)" {
	Properties {
		_Color ("Main Color", Color) = (.5,.5,.5,1)
		_MainTex ("Texture", 2D) = "white" {}
		_FacePaintTex ("FacePaintTexture", 2D) = "Black" {}
		_EyelineTex ("EyelineTexture", 2D) = "Black" {}
		_MouthTex ("MouthTexture", 2D) = "white" {}
		_MixTex ("MixTexture", 2D) = "white" {}

		_ViewTranform("_ViewTranform",Vector) = (0.0, 0.0, 0.0, 0.0)
		_RimColor ("Rim Color", Color) = (0.392, 0.392, 0.588, 0)
		_RimPower ("Rim Power", Float) = 2

		_WrapPower ("Wrap Power", Float) = 0.5
		_LightPower ("Light Power", Float) = 2
		[HideInInspector]
		_ReviseColor("revise", Color) = (.6,.6,.6,1)
	}

	SubShader {
		Tags { "RenderType" = "Opaque" }
		
		CGPROGRAM
		#pragma surface surf WrapLambert
        #include "Assets/GenericFramework/CocoCoreModule/Shader/CGIncludes/CocoCG_Light.cginc"
		#ifndef COCO_INPUTDATA
	    #define COCO_INPUTDATA
        #endif
        #ifndef COCO_SURF
	    #define COCO_SURF(tex, col) tex *= col;
        #endif



        // properties -------------------------------------
        float4 _Color;
        float4 _ReviseColor;
        sampler2D _MainTex;
        sampler2D _MouthTex;
        sampler2D _MixTex;
        sampler2D _EyelineTex;
        sampler2D _FacePaintTex;


        // structs -------------------------------------
        struct Input {
	        half2 uv_MainTex;
	        half2 uv_FacePaintTex;
	        half2 uv2_MouthTex;
	        half3 viewDir;
	        COCO_INPUTDATA
        };

        fixed OverlayBlendMode(fixed basePixel, fixed blendPixel) {  
                if (basePixel < 0.5) {  
                    return (2.0 * basePixel * blendPixel);  
                } else {  
                    return (1.0 - 2.0 * (1.0 - basePixel) * (1.0 - blendPixel));  
                }  
        }  

        // surface function -------------------------------------
        void surf (Input IN, inout SurfaceOutput o) {
	        fixed4 tex = tex2D (_MainTex, IN.uv_MainTex);
	        fixed4 mouthTex = tex2D(_MouthTex, IN.uv2_MouthTex);
	        fixed4 mixTex = tex2D(_MixTex, IN.uv2_MouthTex);
	        fixed4 facepaintTex = tex2D(_FacePaintTex, IN.uv_FacePaintTex);
	        fixed4 eyelineTex = tex2D(_EyelineTex, IN.uv2_MouthTex);

            fixed4 blendedImage = mouthTex;
            blendedImage.r = OverlayBlendMode(mouthTex.r, mixTex.r);
            blendedImage.g = OverlayBlendMode(mouthTex.g, mixTex.g);
            blendedImage.b = OverlayBlendMode(mouthTex.b, mixTex.b);
//	        COCO_SURF(tex, _Color)
//	        blendedImage *= _Color;
//	        o.Albedo = lerp(tex.rgb, blendedImage.rgb, blendedImage.a);
//            o.Albedo = blendedImage.rgb;
            o.Albedo = lerp(lerp(lerp(tex.rgb * _Color.rgb, facepaintTex.rgb * _ReviseColor, facepaintTex.a), eyelineTex.rgb * _ReviseColor, eyelineTex.a),blendedImage.rgb * _ReviseColor, blendedImage.a);
//            o.Albedo = _Color.rgb * tex.rgb * (1.0 - blendedImage.a - facepaintTex.a - eyelineTex.a)  + (blendedImage.rbg * blendedImage.a + facepaintTex.rgb * facepaintTex.a + eyelineTex.rgb * eyelineTex.a) * _Color.rgb;
	        o.Alpha = tex.a;
	    

	        o.Emission = rim (IN.viewDir, o.Normal);
        }
//		#include "Assets/GenericFramework/CocoCoreModule/Shader/CGIncludes/CocoCG_RimWrap.cginc"
		ENDCG
		
	}
	FallBack "Diffuse"
}
