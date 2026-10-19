Shader "Coco/RimWrap/Basic(EyeShadow)" {
	Properties {
		_Color ("Main Color", Color) = (.5,.5,.5,1)
		_MainTex ("Texture", 2D) = "white" {}
		[Space(10)]
        [Header(Eyeshadow)]
        [Space(10)]
//01
		_EyeShadowTex ("EyeShadow", 2D) = "Black" {}
		_EyeShadowMix ("EyeShadowmix",Range(0.0,1.0))=0.0
	//02
	    [Space(10)]
	    [Header(Gold)]	
	    [Space(10)]
		_EyeShadowTex1 ("EyeShadowTex1", 2D) = "Black" {}
		_EyeShadow1Mix ("EyeShadow1mix",Range(0.0,1.0))=0.0
		
	//03
	    [Space(10)]
		[Header(Eyeline)]
	    [Space(10)]
		_EyeLineTex ("EyeLineTex", 2D) = "Black" {}
		_EyeLineMix ("EyeLineMix",Range(0.0,1.0))=0.0
		
		_GradualTex ("GradualTex", 2D) = "Black" {}
		
	

		_RimColor ("Rim Color", Color) = (0.392, 0.392, 0.588, 0)
		_RimPower ("Rim Power", Float) = 2

		_WrapPower ("Wrap Power", Float) = 0.5
		_LightPower ("Light Power", Float) = 2
		[HideInInspector]
		_ReviseColor("revise", Color) = (.6,.6,.6,1)
	}

	SubShader {
		Tags { "RenderType" = "Transorent" "Queue"="Transparent" }
		
		
		Blend SrcAlpha OneMinusSrcAlpha
		
		CGPROGRAM
		#pragma surface surf WrapLambert keepalpha
		
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
        
        float _EyeShadowMix;
        float _EyeShadow1Mix; 
        float _EyeLineMix;
         
           
        sampler2D _GradualTex;
       
        sampler2D _EyeShadowTex1;
        sampler2D _EyeShadowTex;
        sampler2D _EyeLineTex;


        // structs -------------------------------------
        struct Input {
	        half2 uv_MainTex;
	        half2 uv_EyeShadowTex;
	        half3 viewDir;
	        COCO_INPUTDATA
        };

       /* fixed OverlayBlendMode(fixed basePixel, fixed blendPixel) {  
                if (basePixel < 0.5) {  
                    return (2.0 * basePixel * blendPixel);  
                } else {  
                    return (1.0 - 2.0 * (1.0 - basePixel) * (1.0 - blendPixel));  
                }  
        } */ 

        // surface function -------------------------------------
        void surf (Input IN, inout SurfaceOutput o) {
	        fixed4 tex = tex2D (_MainTex, IN.uv_MainTex);
	      
	        
	        fixed4 GradualTex = tex2D(_GradualTex,IN.uv_EyeShadowTex);
	        
	        
	       
	        //01
	         fixed4 facepaintTex = tex2D(_EyeShadowTex, IN.uv_EyeShadowTex);
	       float eyeShadowMix =step(GradualTex.r,_EyeShadowMix);
	        
	       float eyeShadowTexMix  = facepaintTex.a * eyeShadowMix;
	       
	       //02
	       fixed4 eyeShadowTex1 = tex2D(_EyeShadowTex1, IN.uv_EyeShadowTex);
	       float eyeShadow1Mix =step(GradualTex.r,_EyeShadow1Mix);
	       float eyeShadowTex1Mix  = eyeShadowTex1.a * eyeShadow1Mix;
	       
	       //03
	       fixed4 eyelineTex= tex2D(_EyeLineTex, IN.uv_EyeShadowTex);
	       float  eyeLineMix = step(GradualTex.r,_EyeLineMix);
	       float eyelineMix1 = eyelineTex.a * eyeLineMix;
	       
	      
            o.Emission = lerp(lerp(lerp(tex.rgb * _Color.rgb, facepaintTex.rgb, eyeShadowTexMix), eyeShadowTex1.rgb , eyeShadowTex1Mix),eyelineTex.rgb,eyelineMix1);
	        //o.Alpha = tex.a;
	        
	        o.Alpha = saturate(facepaintTex.a * eyeShadowTexMix + eyeShadowTex1.a * eyeShadowTex1Mix  + eyelineTex.a * eyelineMix1);
                       // o.Alpha = facepaintTex.a * eyeShadowTexMix ;
	        //o.Alpha = 0;

	       // o.Emission = rim (IN.viewDir, o.Normal);
	        
        }
//		#include "Assets/GenericFramework/CocoCoreModule/Shader/CGIncludes/CocoCG_RimWrap.cginc"
		ENDCG
		
	}
	FallBack "Diffuse"
}
