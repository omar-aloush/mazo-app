import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle as SvgCircle, Path, Ellipse, Rect, G } from 'react-native-svg';
import { MazoConfig, MazoState, MazoEyeStyle, MazoMouthStyle, MazoAccessory } from '@/types';
import { STATE_COLORS, STATE_GRADIENT_COLORS } from '@/constants/mazo';

interface MazoCharacterProps {
  config: MazoConfig;
  state?: MazoState;
  size?: number;
  showAccessory?: boolean;
}

export function MazoCharacter({
  config,
  state = 'idle',
  size = 120,
  showAccessory = true,
}: MazoCharacterProps) {
  const scale = size / 120;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const eyeLeftAnim = useRef(new Animated.Value(0)).current;
  const eyeRightAnim = useRef(new Animated.Value(0)).current;
  const mouthAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const nodAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const blinkLoop = () => {
      const delay = 2500 + Math.random() * 3500;
      setTimeout(() => {
        if (config.eyeStyle !== 'closed') {
          Animated.sequence([
            Animated.timing(blinkAnim, {
              toValue: 0.1,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(blinkAnim, {
              toValue: 1,
              duration: 80,
              useNativeDriver: true,
            }),
          ]).start(() => blinkLoop());
        } else {
          blinkLoop();
        }
      }, delay);
    };
    blinkLoop();
  }, [blinkAnim, config.eyeStyle]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -3,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 3,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  useEffect(() => {
    eyeLeftAnim.stopAnimation();
    eyeRightAnim.stopAnimation();
    pulseAnim.stopAnimation();
    mouthAnim.stopAnimation();
    glowAnim.stopAnimation();
    nodAnim.stopAnimation();

    if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (state === 'thinking') {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(eyeLeftAnim, {
              toValue: -4,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(eyeRightAnim, {
              toValue: -4,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(eyeLeftAnim, {
              toValue: 4,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(eyeRightAnim, {
              toValue: 4,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(eyeLeftAnim, {
              toValue: 0,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(eyeRightAnim, {
              toValue: 0,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(mouthAnim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(mouthAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (state === 'responding') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(mouthAnim, {
            toValue: 1,
            duration: 150,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(mouthAnim, {
            toValue: 0,
            duration: 150,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (state === 'memory_save') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(nodAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(nodAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.timing(glowAnim, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (state === 'plan_ready') {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(glowAnim, {
        toValue: 0.8,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else if (state === 'happy') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.timing(glowAnim, {
        toValue: 0.5,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else if (state === 'empathetic') {
      // Gentle nodding with warm glow - for supportive moments
      Animated.loop(
        Animated.sequence([
          Animated.timing(nodAnim, {
            toValue: 0.5,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(nodAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.timing(glowAnim, {
        toValue: 0.6,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else if (state === 'encouraging') {
      // Upbeat bounce with pulse - for motivation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -4,
            duration: 350,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 350,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (state === 'celebrating') {
      // Excited jump with bright glow - for wins
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: -8,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(400),
        ])
      ).start();

      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
      mouthAnim.setValue(0);
      eyeLeftAnim.setValue(0);
      eyeRightAnim.setValue(0);
      nodAnim.setValue(0);
    }

    return () => {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      mouthAnim.stopAnimation();
      eyeLeftAnim.stopAnimation();
      eyeRightAnim.stopAnimation();
      nodAnim.stopAnimation();
    };
  }, [state, pulseAnim, glowAnim, mouthAnim, eyeLeftAnim, eyeRightAnim, nodAnim, floatAnim]);

  const gradientColors = STATE_GRADIENT_COLORS[state] || STATE_GRADIENT_COLORS.idle;
  const featureColor = STATE_COLORS[state] || STATE_COLORS.idle;
  const accentColor = config.accentColor || '#6366F1';

  const eyeSpacing = 28 * scale;
  const eyeSize = getEyeSize(config.eyeStyle, scale);

  const mouthScale = mouthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const nodTranslate = nodAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });

  const isCompact = size <= 60;
  const glowPad = isCompact ? 6 : 16;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY: isCompact ? 0 : floatAnim }],
        },
      ]}
    >
      {!isCompact && (
        <View style={[styles.shadowOuter, { width: size * 1.1, height: size * 0.12, borderRadius: size * 0.5 }]} />
      )}

      <Animated.View
        style={[
          styles.glowRing,
          {
            width: size + glowPad,
            height: size + glowPad,
            borderRadius: (size + glowPad) / 2,
            opacity: glowAnim,
            backgroundColor: featureColor === '#3D3D3D' ? 'rgba(124,154,130,0.12)' : `${featureColor}18`,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [
              { scale: pulseAnim },
              { translateY: nodTranslate },
            ],
          },
        ]}
      >
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="mazoFaceGradient" cx="35%" cy="30%" rx="60%" ry="60%">
              <Stop offset="0%" stopColor={gradientColors.light} stopOpacity="1" />
              <Stop offset="50%" stopColor={gradientColors.mid} stopOpacity="1" />
              <Stop offset="100%" stopColor={gradientColors.dark} stopOpacity="1" />
            </RadialGradient>
            <RadialGradient id="mazoInnerShadow" cx="50%" cy="80%" rx="50%" ry="30%">
              <Stop offset="0%" stopColor="#C0B8B0" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#C0B8B0" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="mazoHighlight" cx="30%" cy="25%" rx="30%" ry="30%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <SvgCircle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#mazoFaceGradient)" />
          <SvgCircle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#mazoInnerShadow)" />
          <SvgCircle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#mazoHighlight)" />

          {(state === 'listening' || state === 'memory_save' || state === 'plan_ready') && (
            <SvgCircle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 2}
              fill="none"
              stroke={featureColor}
              strokeWidth="2.5"
              opacity={0.6}
            />
          )}
        </Svg>

        {showAccessory && config.accessory !== 'none' && (
          <View style={[styles.accessoryContainer, { top: -2 * scale }]}>
            <AccessoryRenderer
              accessory={config.accessory}
              size={size}
              scale={scale}
              accentColor={accentColor}
            />
          </View>
        )}

        <View style={styles.faceContainer}>
          <View style={[styles.eyesContainer, { gap: eyeSpacing, marginBottom: 12 * scale }]}>
            <Animated.View
              style={{
                transform: [
                  { translateX: eyeLeftAnim },
                  { scaleY: config.eyeStyle === 'closed' ? 0.2 : blinkAnim },
                ],
              }}
            >
              <EyeRenderer
                eyeStyle={config.eyeStyle}
                size={eyeSize}
                color={featureColor}
                scale={scale}
              />
            </Animated.View>
            <Animated.View
              style={{
                transform: [
                  { translateX: eyeRightAnim },
                  { scaleY: config.eyeStyle === 'closed' ? 0.2 : blinkAnim },
                ],
              }}
            >
              <EyeRenderer
                eyeStyle={config.eyeStyle}
                size={eyeSize}
                color={featureColor}
                scale={scale}
              />
            </Animated.View>
          </View>

          <Animated.View style={{ transform: [{ scaleY: mouthScale }] }}>
            <MouthRenderer
              mouthStyle={state === 'happy' ? 'slight_smile' : config.mouthStyle}
              scale={scale}
              color={featureColor}
              state={state}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function getEyeSize(eyeStyle: MazoEyeStyle, scale: number): number {
  switch (eyeStyle) {
    case 'focused':
      return 7 * scale;
    case 'soft':
      return 5 * scale;
    case 'closed':
      return 8 * scale;
    default:
      return 6 * scale;
  }
}

interface EyeRendererProps {
  eyeStyle: MazoEyeStyle;
  size: number;
  color: string;
  scale: number;
}

function EyeRenderer({ eyeStyle, size, color, scale }: EyeRendererProps) {
  if (eyeStyle === 'closed') {
    return (
      <Svg width={size * 1.5} height={size * 0.5}>
        <Path
          d={`M 0 ${size * 0.25} Q ${size * 0.75} ${size * 0.5} ${size * 1.5} ${size * 0.25}`}
          stroke={color}
          strokeWidth={2 * scale}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (eyeStyle === 'soft') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.85,
        }}
      />
    );
  }

  if (eyeStyle === 'focused') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
            backgroundColor: '#FFFFFF',
            top: size * 0.15,
            left: size * 0.15,
            opacity: 0.8,
          }}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

interface MouthRendererProps {
  mouthStyle: MazoMouthStyle;
  scale: number;
  color: string;
  state: MazoState;
}

function MouthRenderer({ mouthStyle, scale, color, state }: MouthRendererProps) {
  const width = 28 * scale;
  const height = 14 * scale;

  if (mouthStyle === 'slight_smile' || state === 'happy') {
    return (
      <Svg width={width} height={height}>
        <Path
          d={`M 2 2 Q ${width / 2} ${height + 2} ${width - 2} 2`}
          stroke={color}
          strokeWidth={2 * scale}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (mouthStyle === 'thinking' || state === 'thinking') {
    return (
      <Svg width={width * 0.6} height={height * 0.5}>
        <Ellipse
          cx={width * 0.3}
          cy={height * 0.25}
          rx={width * 0.2}
          ry={height * 0.2}
          fill={color}
          opacity={0.7}
        />
      </Svg>
    );
  }

  if (mouthStyle === 'calm') {
    return (
      <Svg width={width * 0.75} height={height * 0.6}>
        <Path
          d={`M 3 2 Q ${width * 0.375} ${height * 0.45} ${width * 0.75 - 3} 2`}
          stroke={color}
          strokeWidth={1.8 * scale}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (mouthStyle === 'neutral') {
    return (
      <Svg width={width * 0.7} height={height * 0.5}>
        <Path
          d={`M 2 ${height * 0.25} L ${width * 0.7 - 2} ${height * 0.25}`}
          stroke={color}
          strokeWidth={2 * scale}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (mouthStyle === 'strong') {
    return (
      <Svg width={width * 0.9} height={height * 0.7}>
        <Path
          d={`M 2 ${height * 0.15} Q ${width * 0.45} ${height * 0.55} ${width * 0.88} ${height * 0.15}`}
          stroke={color}
          strokeWidth={2.5 * scale}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height}>
      <Path
        d={`M 4 4 Q ${width / 2} ${height - 2} ${width - 4} 4`}
        stroke={color}
        strokeWidth={2 * scale}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

interface AccessoryRendererProps {
  accessory: MazoAccessory;
  size: number;
  scale: number;
  accentColor: string;
}

function AccessoryRenderer({ accessory, size, scale, accentColor }: AccessoryRendererProps) {
  if (accessory === 'cap') {
    return (
      <Svg width={size * 0.9} height={size * 0.35} style={{ position: 'absolute', top: -size * 0.08 }}>
        <Defs>
          <RadialGradient id="capGradient" cx="50%" cy="30%" rx="60%" ry="60%">
            <Stop offset="0%" stopColor={accentColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={darkenColor(accentColor, 20)} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Path
          d={`M ${size * 0.1} ${size * 0.28} 
              Q ${size * 0.1} ${size * 0.12} ${size * 0.45} ${size * 0.08}
              Q ${size * 0.8} ${size * 0.04} ${size * 0.8} ${size * 0.28}
              Z`}
          fill="url(#capGradient)"
        />
        <Rect
          x={size * 0.65}
          y={size * 0.18}
          width={size * 0.22}
          height={size * 0.06}
          rx={size * 0.02}
          fill={darkenColor(accentColor, 30)}
        />
      </Svg>
    );
  }

  if (accessory === 'visor') {
    return (
      <Svg width={size * 0.85} height={size * 0.2} style={{ position: 'absolute', top: size * 0.08 }}>
        <Defs>
          <RadialGradient id="visorGradient" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={accentColor} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={darkenColor(accentColor, 25)} stopOpacity="0.9" />
          </RadialGradient>
        </Defs>
        <Path
          d={`M 0 ${size * 0.12}
              Q ${size * 0.425} ${size * 0.02} ${size * 0.85} ${size * 0.12}
              L ${size * 0.85} ${size * 0.16}
              Q ${size * 0.425} ${size * 0.06} 0 ${size * 0.16}
              Z`}
          fill="url(#visorGradient)"
        />
      </Svg>
    );
  }

  if (accessory === 'glasses') {
    return (
      <Svg width={size * 0.75} height={size * 0.25} style={{ position: 'absolute', top: size * 0.28 }}>
        <G>
          <SvgCircle
            cx={size * 0.18}
            cy={size * 0.125}
            r={size * 0.12}
            fill="none"
            stroke={accentColor}
            strokeWidth={2 * scale}
          />
          <SvgCircle
            cx={size * 0.57}
            cy={size * 0.125}
            r={size * 0.12}
            fill="none"
            stroke={accentColor}
            strokeWidth={2 * scale}
          />
          <Path
            d={`M ${size * 0.3} ${size * 0.125} L ${size * 0.45} ${size * 0.125}`}
            stroke={accentColor}
            strokeWidth={1.5 * scale}
          />
        </G>
      </Svg>
    );
  }

  return null;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowOuter: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  glowRing: {
    position: 'absolute',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B7E74',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  accessoryContainer: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
  },
  faceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  eyesContainer: {
    flexDirection: 'row',
  },
});
