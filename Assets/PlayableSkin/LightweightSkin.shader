Shader "Playable/Lightweight Skin"
{
    Properties
    {
        _MainTex ("Base Texture (RGB=Color A=Spec)", 2D) = "white" {}
        _Color ("Main Color", Color) = (1,1,1,1)
        _FacePaintTex ("FacePaintTexture", 2D) = "black" {}
        _Wrap ("Wrap (0 = Lambert)", Range(0,1)) = 0.3
        _ShadowTint ("Diffuse Terminator Tint", Color) = (1,0.8,0.75,1)
        _BrightTint ("Bright Diffuse Color", Color) = (1,1,1,1)
        _DarkTint ("Dark Diffuse Color", Color) = (0.2,0.2,0.2,1)
        _AmbientColor ("Ambient / Light Probe Color", Color) = (1,1,1,1)
        _SkinSpecColor ("Specular Color", Color) = (0.12,0.1104,0.1032,1)
        _SpecPower ("Specular Power (lower = softer)", Range(4,64)) = 20
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 150
        Cull Back
        ZWrite On
        Pass
        {
            Name "FORWARD"
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase nolightmap nodirlightmap nodynlightmap novertexlight
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            sampler2D _MainTex, _FacePaintTex;
            float4 _MainTex_ST, _FacePaintTex_ST;
            half4 _Color, _ShadowTint, _SkinSpecColor;
            half4 _BrightTint, _DarkTint, _AmbientColor;
            half _Wrap, _SpecPower;

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                float2 uv : TEXCOORD0;
            };
            struct v2f
            {
                float4 pos : SV_POSITION;
                float4 uv : TEXCOORD0;
                float3 worldPos : TEXCOORD1;
                half3 worldNormal : TEXCOORD2;
                half3 ambient : TEXCOORD3;
                SHADOW_COORDS(4)
                UNITY_FOG_COORDS(5)
            };
            v2f vert(appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv.xy = TRANSFORM_TEX(v.uv, _MainTex);
                o.uv.zw = TRANSFORM_TEX(v.uv, _FacePaintTex);
                o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.ambient = max(half3(0,0,0), ShadeSH9(half4(o.worldNormal,1)));
                TRANSFER_SHADOW(o);
                UNITY_TRANSFER_FOG(o,o.pos);
                return o;
            }
            half4 frag(v2f i) : SV_Target
            {
                half4 baseTexture = tex2D(_MainTex, i.uv.xy);
                half3 albedo = baseTexture.rgb * _Color.rgb;
                half4 facePaint = tex2D(_FacePaintTex, i.uv.zw);
                // Paint alpha controls coverage; full alpha replaces the base color.
                albedo = lerp(albedo, facePaint.rgb, facePaint.a);
                half3 n = normalize(i.worldNormal);
                // float normalization avoids half-precision overflow for large scenes.
                half3 l = normalize(UnityWorldSpaceLightDir(i.worldPos));
                half ndl = clamp(dot(n,l), -1.0h, 1.0h);
                half wrap = saturate(_Wrap);
                half d = saturate((ndl + wrap) / (1.0h + wrap));
                half3 diffuse = d * lerp(_ShadowTint.rgb, half3(1,1,1), d);
                // Partition follows wrapped N.L, not view direction or specular intensity.
                half brightWeight = smoothstep(0.15h, 0.85h, d);
                UNITY_LIGHT_ATTENUATION(atten, i, i.worldPos);
                half3 mainLight = _LightColor0.rgb * atten;
                // The dark color is an artistic fill target, independent of light intensity.
                // This allows ordinary 0..1 colors to brighten an otherwise unlit back side.
                half3 litColor = albedo * (i.ambient * _AmbientColor.rgb
                    + diffuse * mainLight);
                half3 darkColor = albedo * _DarkTint.rgb;
                half3 color = lerp(darkColor, litColor * _BrightTint.rgb, brightWeight);
                float3 v = normalize(lerp(UnityWorldSpaceViewDir(i.worldPos),
                    UNITY_MATRIX_V[2].xyz, unity_OrthoParams.w));
                float3 sumLV = (float3)l + v;
                half3 h = sumLV * rsqrt(max(dot(sumLV,sumLV), 1e-6));
                half spec = pow(saturate(dot(n,h)), max(_SpecPower,4.0h));
                spec *= saturate(ndl * 4.0h) * baseTexture.a;
                color += _SkinSpecColor.rgb * spec * mainLight;
                half4 outputColor = half4(color,1);
                UNITY_APPLY_FOG(i.fogCoord, outputColor);
                return outputColor;
            }
            ENDCG
        }
        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On
            ZTest LEqual
            CGPROGRAM
            #pragma target 3.0
            #pragma vertex vertShadow
            #pragma fragment fragShadow
            #pragma multi_compile_shadowcaster
            #include "UnityCG.cginc"
            struct v2fShadow { V2F_SHADOW_CASTER; };
            v2fShadow vertShadow(appdata_base v)
            {
                v2fShadow o;
                TRANSFER_SHADOW_CASTER_NORMALOFFSET(o)
                return o;
            }
            float4 fragShadow(v2fShadow i) : SV_Target { SHADOW_CASTER_FRAGMENT(i) }
            ENDCG
        }
    }
    Fallback Off
}
