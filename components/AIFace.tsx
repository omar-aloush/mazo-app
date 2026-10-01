import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle as SvgCircle, Path, Ellipse } from 'react-native-svg';

export type FaceExpression =
  | 'idle'
  | 'talking'
  | 'thinking'
  | 'happy'
  | 'listening'
  | 'curious'
  | 'proud'
  | 'encouraging'
  | 'concerned'
  | 'surprised'
  | 'focused'
  | 'celebrating';

interface AIFaceProps {
  expression?: FaceExpression;
  size?: number;
}

const EXPRESSION_COLORS: Record<FaceExpression, { glow: string; accent: string }> = {
  idle: { glow: 'rgba(124,154,130,0.0)', accent: '#7C9A82' },
  talking: { glow: 'rgba(124,154,130,0.12)', accent: '#7C9A82' },
  thinking: { glow: 'rgba(124,111,160,0.10)', accent: '#7C6FA0' },
  happy: { glow: 'rgba(124,154,130,0.15)', accent: '#7C9A82' },
  listening: { glow: 'rgba(90,143,123,0.10)', accent: '#5A8F7B' },
  curious: { glow: 'rgba(124,111,160,0.12)', accent: '#7C6FA0' },
  proud: { glow: 'rgba(212,165,116,0.15)', accent: '#D4A574' },
  encouraging: { glow: 'rgba(124,154,130,0.18)', accent: '#7C9A82' },
  concerned: { glow: 'rgba(194,112,112,0.10)', accent: '#C27070' },
  surprised: { glow: 'rgba(124,111,160,0.15)', accent: '#7C6FA0' },
  focused: { glow: 'rgba(90,120,96,0.12)', accent: '#5A7860' },
  celebrating: { glow: 'rgba(212,165,116,0.20)', accent: '#D4A574' },
};

export function AIFace({ expression = 'idle', size = 120 }: AIFaceProps) {
  const eyeLeftX = useRef(new Animated.Value(0)).current;
  const eyeLeftY = useRef(new Animated.Value(0)).current;
  const eyeRightX = useRef(new Animated.Value(0)).current;
  const eyeRightY = useRef(new Animated.Value(0)).current;
  const pupilScale = useRef(new Animated.Value(1)).current;
  const browLeftY = useRef(new Animated.Value(0)).current;
  const browRightY = useRef(new Animated.Value(0)).current;
  const browLeftRotate = useRef(new Animated.Value(0)).current;
  const browRightRotate = useRef(new Animated.Value(0)).current;
  const mouthOpenness = useRef(new Animated.Value(0)).current;
  const mouthWidth = useRef(new Animated.Value(1)).current;
  const mouthCurve = useRef(new Animated.Value(0.5)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const cheekOpacity = useRef(new Animated.Value(0)).current;
  const eyeSquint = useRef(new Animated.Value(1)).current;

  const scale = size / 120;
  const colors = EXPRESSION_COLORS[expression];

  useEffect(() => {
    let blinkTimeout: ReturnType<typeof setTimeout>;
    const blinkLoop = () => {
      const delay = 2500 + Math.random() * 4000;
      blinkTimeout = setTimeout(() => {
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.05,
            duration: 70,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => blinkLoop());
      }, delay);
    };
    blinkLoop();
    return () => clearTimeout(blinkTimeout);
  }, [blinkAnim]);

  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -3,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 3,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    float.start();
    return () => float.stop();
  }, [floatAnim]);

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.015,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [breatheAnim]);

  useEffect(() => {
    const resetAll = () => {
      const resetAnims = [
        eyeLeftX, eyeLeftY, eyeRightX, eyeRightY,
        browLeftY, browRightY, browLeftRotate, browRightRotate,
        mouthOpenness, glowAnim, cheekOpacity,
      ];
      resetAnims.forEach(a => {
        a.stopAnimation();
        Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      });
      Animated.timing(pupilScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(mouthWidth, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(mouthCurve, { toValue: 0.5, duration: 200, useNativeDriver: false }).start();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(eyeSquint, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    };

    resetAll();

    const animations: Animated.CompositeAnimation[] = [];

    switch (expression) {
      case 'talking': {
        const talkMouth = Animated.loop(
          Animated.sequence([
            Animated.timing(mouthOpenness, { toValue: 1, duration: 120 + Math.random() * 80, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(mouthOpenness, { toValue: 0.3, duration: 100 + Math.random() * 60, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(mouthOpenness, { toValue: 0.7, duration: 110, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(mouthOpenness, { toValue: 0, duration: 140, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        );
        talkMouth.start();
        animations.push(talkMouth);

        Animated.timing(mouthCurve, { toValue: 0.6, duration: 300, useNativeDriver: false }).start();

        const talkPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.02, duration: 250, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
          ])
        );
        talkPulse.start();
        animations.push(talkPulse);
        Animated.timing(glowAnim, { toValue: 0.5, duration: 400, useNativeDriver: true }).start();
        break;
      }

      case 'thinking': {
        const thinkEyes = Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(eyeLeftX, { toValue: -4, duration: 900, useNativeDriver: true }),
              Animated.timing(eyeRightX, { toValue: -4, duration: 900, useNativeDriver: true }),
              Animated.timing(eyeLeftY, { toValue: -2, duration: 900, useNativeDriver: true }),
              Animated.timing(eyeRightY, { toValue: -2, duration: 900, useNativeDriver: true }),
            ]),
            Animated.delay(400),
            Animated.parallel([
              Animated.timing(eyeLeftX, { toValue: 4, duration: 1200, useNativeDriver: true }),
              Animated.timing(eyeRightX, { toValue: 4, duration: 1200, useNativeDriver: true }),
              Animated.timing(eyeLeftY, { toValue: 1, duration: 1200, useNativeDriver: true }),
              Animated.timing(eyeRightY, { toValue: 1, duration: 1200, useNativeDriver: true }),
            ]),
            Animated.delay(300),
            Animated.parallel([
              Animated.timing(eyeLeftX, { toValue: 0, duration: 800, useNativeDriver: true }),
              Animated.timing(eyeRightX, { toValue: 0, duration: 800, useNativeDriver: true }),
              Animated.timing(eyeLeftY, { toValue: 0, duration: 800, useNativeDriver: true }),
              Animated.timing(eyeRightY, { toValue: 0, duration: 800, useNativeDriver: true }),
            ]),
          ])
        );
        thinkEyes.start();
        animations.push(thinkEyes);

        Animated.timing(browLeftY, { toValue: -4, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browRightY, { toValue: -4, duration: 300, useNativeDriver: true }).start();
        Animated.timing(mouthCurve, { toValue: 0.4, duration: 300, useNativeDriver: false }).start();
        Animated.timing(pupilScale, { toValue: 0.9, duration: 300, useNativeDriver: true }).start();
        Animated.timing(glowAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }).start();
        break;
      }

      case 'listening': {
        const listenPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        );
        listenPulse.start();
        animations.push(listenPulse);

        Animated.timing(pupilScale, { toValue: 1.15, duration: 400, useNativeDriver: true }).start();
        Animated.timing(browLeftY, { toValue: -2, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browRightY, { toValue: -2, duration: 300, useNativeDriver: true }).start();
        Animated.timing(mouthCurve, { toValue: 0.45, duration: 300, useNativeDriver: false }).start();
        Animated.timing(glowAnim, { toValue: 0.4, duration: 400, useNativeDriver: true }).start();
        break;
      }

      case 'happy': {
        Animated.timing(mouthCurve, { toValue: 0.8, duration: 300, useNativeDriver: false }).start();
        Animated.timing(mouthWidth, { toValue: 1.2, duration: 300, useNativeDriver: true }).start();
        Animated.timing(eyeSquint, { toValue: 0.7, duration: 300, useNativeDriver: true }).start();
        Animated.timing(cheekOpacity, { toValue: 0.6, duration: 400, useNativeDriver: true }).start();
        Animated.timing(glowAnim, { toValue: 0.6, duration: 400, useNativeDriver: true }).start();
        break;
      }

      case 'curious': {
        Animated.timing(pupilScale, { toValue: 1.25, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browLeftY, { toValue: -5, duration: 250, useNativeDriver: true }).start();
        Animated.timing(browRightY, { toValue: -2, duration: 250, useNativeDriver: true }).start();
        Animated.timing(browLeftRotate, { toValue: -5, duration: 250, useNativeDriver: true }).start();
        Animated.timing(mouthCurve, { toValue: 0.55, duration: 300, useNativeDriver: false }).start();
        Animated.timing(mouthOpenness, { toValue: 0.3, duration: 300, useNativeDriver: true }).start();

        const curiousLook = Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(eyeLeftX, { toValue: 2, duration: 1000, useNativeDriver: true }),
              Animated.timing(eyeRightX, { toValue: 2, duration: 1000, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(eyeLeftX, { toValue: -1, duration: 1200, useNativeDriver: true }),
              Animated.timing(eyeRightX, { toValue: -1, duration: 1200, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(eyeLeftX, { toValue: 0, duration: 800, useNativeDriver: true }),
              Animated.timing(eyeRightX, { toValue: 0, duration: 800, useNativeDriver: true }),
            ]),
          ])
        );
        curiousLook.start();
        animations.push(curiousLook);
        Animated.timing(glowAnim, { toValue: 0.4, duration: 400, useNativeDriver: true }).start();
        break;
      }

      case 'proud': {
        Animated.timing(mouthCurve, { toValue: 0.75, duration: 400, useNativeDriver: false }).start();
        Animated.timing(mouthWidth, { toValue: 1.15, duration: 300, useNativeDriver: true }).start();
        Animated.timing(eyeSquint, { toValue: 0.75, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browLeftY, { toValue: -3, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browRightY, { toValue: -3, duration: 300, useNativeDriver: true }).start();
        Animated.timing(cheekOpacity, { toValue: 0.5, duration: 400, useNativeDriver: true }).start();
        Animated.timing(glowAnim, { toValue: 0.7, duration: 500, useNativeDriver: true }).start();

        const proudPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          ])
        );
        proudPulse.start();
        animations.push(proudPulse);
        break;
      }

      case 'encouraging': {
        Animated.timing(mouthCurve, { toValue: 0.7, duration: 300, useNativeDriver: false }).start();
        Animated.timing(mouthWidth, { toValue: 1.1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(pupilScale, { toValue: 1.1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browLeftY, { toValue: -3, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browRightY, { toValue: -3, duration: 300, useNativeDriver: true }).start();
        Animated.timing(cheekOpacity, { toValue: 0.3, duration: 400, useNativeDriver: true }).start();

        const encouragePulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 0.8, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        );
        encouragePulse.start();
        animations.push(encouragePulse);
        break;
      }

      case 'concerned': {
        Animated.timing(mouthCurve, { toValue: 0.3, duration: 300, useNativeDriver: false }).start();
        Animated.timing(browLeftY, { toValue: -4, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browRightY, { toValue: -1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browLeftRotate, { toValue: 8, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browRightRotate, { toValue: -8, duration: 300, useNativeDriver: true }).start();
        Animated.timing(pupilScale, { toValue: 1.1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(eyeLeftY, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(eyeRightY, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(glowAnim, { toValue: 0.2, duration: 400, useNativeDriver: true }).start();
        break;
      }

      case 'surprised': {
        Animated.timing(pupilScale, { toValue: 1.35, duration: 200, useNativeDriver: true }).start();
        Animated.timing(browLeftY, { toValue: -6, duration: 200, useNativeDriver: true }).start();
        Animated.timing(browRightY, { toValue: -6, duration: 200, useNativeDriver: true }).start();
        Animated.timing(mouthOpenness, { toValue: 0.8, duration: 200, useNativeDriver: true }).start();
        Animated.timing(mouthCurve, { toValue: 0.5, duration: 200, useNativeDriver: false }).start();
        Animated.timing(glowAnim, { toValue: 0.5, duration: 300, useNativeDriver: true }).start();
        break;
      }

      case 'focused': {
        Animated.timing(eyeSquint, { toValue: 0.8, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browLeftY, { toValue: -2, duration: 300, useNativeDriver: true }).start();
        Animated.timing(browRightY, { toValue: -2, duration: 300, useNativeDriver: true }).start();
        Animated.timing(pupilScale, { toValue: 0.85, duration: 300, useNativeDriver: true }).start();
        Animated.timing(mouthCurve, { toValue: 0.45, duration: 300, useNativeDriver: false }).start();
        Animated.timing(glowAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }).start();
        break;
      }

      case 'celebrating': {
        Animated.timing(mouthCurve, { toValue: 0.9, duration: 250, useNativeDriver: false }).start();
        Animated.timing(mouthWidth, { toValue: 1.3, duration: 250, useNativeDriver: true }).start();
        Animated.timing(mouthOpenness, { toValue: 0.6, duration: 250, useNativeDriver: true }).start();
        Animated.timing(eyeSquint, { toValue: 0.6, duration: 250, useNativeDriver: true }).start();
        Animated.timing(cheekOpacity, { toValue: 0.7, duration: 300, useNativeDriver: true }).start();

        const celebPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          ])
        );
        celebPulse.start();
        animations.push(celebPulse);

        const celebGlow = Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
          ])
        );
        celebGlow.start();
        animations.push(celebGlow);
        break;
      }

      default:
        Animated.timing(mouthCurve, { toValue: 0.5, duration: 300, useNativeDriver: false }).start();
        break;
    }

    return () => {
      animations.forEach(a => a.stop());
    };
  }, [expression]);

  const eyeSpacing = 28 * scale;
  const eyeSize = 9 * scale;
  const pupilSize = 4.5 * scale;
  const highlightSize = 2 * scale;
  const featureColor = '#2D2D2D';
  const browWidth = 10 * scale;
  const browHeight = 2.2 * scale;

  const mouthInterp = mouthCurve.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-0.3', '0', '1'],
  });

  const isCompact = size <= 60;
  const glowPad = isCompact ? 4 : 16;

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
            backgroundColor: colors.glow.replace('0.', '0.'),
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
            backgroundColor: '#DDD7CF',
            transform: [
              { scale: Animated.multiply(pulseAnim, breatheAnim) },
            ],
          },
        ]}
      >
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="faceGradient" cx="35%" cy="28%" rx="62%" ry="62%">
              <Stop offset="0%" stopColor="#EBE7E2" stopOpacity="1" />
              <Stop offset="30%" stopColor="#E0DBD4" stopOpacity="1" />
              <Stop offset="65%" stopColor="#D4CEC6" stopOpacity="1" />
              <Stop offset="100%" stopColor="#C8C2BA" stopOpacity="1" />
            </RadialGradient>
            <RadialGradient id="innerShadow" cx="50%" cy="82%" rx="50%" ry="28%">
              <Stop offset="0%" stopColor="#A8A4A0" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#C8C4C0" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="highlight" cx="28%" cy="22%" rx="28%" ry="28%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="rimLight" cx="72%" cy="25%" rx="18%" ry="18%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <SvgCircle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="#E0DBD4" />
          <SvgCircle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#faceGradient)" />
          <SvgCircle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#innerShadow)" />
          <SvgCircle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#highlight)" />
          <SvgCircle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="url(#rimLight)" />
        </Svg>

        <View style={styles.faceContainer}>
          {/* Eyebrows */}
          <View style={[styles.eyesContainer, { gap: eyeSpacing + 6, marginBottom: 3 * scale }]}>
            <Animated.View
              style={{
                width: browWidth,
                height: browHeight,
                borderRadius: browHeight / 2,
                backgroundColor: featureColor,
                opacity: 0.35,
                transform: [
                  { translateY: browLeftY },
                  { rotate: browLeftRotate.interpolate({
                    inputRange: [-10, 0, 10],
                    outputRange: ['-10deg', '0deg', '10deg'],
                  })},
                ],
              }}
            />
            <Animated.View
              style={{
                width: browWidth,
                height: browHeight,
                borderRadius: browHeight / 2,
                backgroundColor: featureColor,
                opacity: 0.35,
                transform: [
                  { translateY: browRightY },
                  { rotate: browRightRotate.interpolate({
                    inputRange: [-10, 0, 10],
                    outputRange: ['-10deg', '0deg', '10deg'],
                  })},
                ],
              }}
            />
          </View>

          {/* Eyes */}
          <View style={[styles.eyesContainer, { gap: eyeSpacing, marginBottom: 10 * scale }]}>
            {/* Left Eye */}
            <Animated.View
              style={{
                width: eyeSize,
                height: eyeSize,
                borderRadius: eyeSize / 2,
                backgroundColor: '#F5F3F0',
                borderWidth: 1.5 * scale,
                borderColor: featureColor,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                transform: [
                  { scaleY: Animated.multiply(blinkAnim, eyeSquint) },
                ],
              }}
            >
              <Animated.View
                style={{
                  width: pupilSize,
                  height: pupilSize,
                  borderRadius: pupilSize / 2,
                  backgroundColor: featureColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [
                    { translateX: eyeLeftX },
                    { translateY: eyeLeftY },
                    { scale: pupilScale },
                  ],
                }}
              >
                <View
                  style={{
                    width: highlightSize,
                    height: highlightSize,
                    borderRadius: highlightSize / 2,
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: 0.5 * scale,
                    right: 0.5 * scale,
                  }}
                />
              </Animated.View>
            </Animated.View>

            {/* Right Eye */}
            <Animated.View
              style={{
                width: eyeSize,
                height: eyeSize,
                borderRadius: eyeSize / 2,
                backgroundColor: '#F5F3F0',
                borderWidth: 1.5 * scale,
                borderColor: featureColor,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                transform: [
                  { scaleY: Animated.multiply(blinkAnim, eyeSquint) },
                ],
              }}
            >
              <Animated.View
                style={{
                  width: pupilSize,
                  height: pupilSize,
                  borderRadius: pupilSize / 2,
                  backgroundColor: featureColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [
                    { translateX: eyeRightX },
                    { translateY: eyeRightY },
                    { scale: pupilScale },
                  ],
                }}
              >
                <View
                  style={{
                    width: highlightSize,
                    height: highlightSize,
                    borderRadius: highlightSize / 2,
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: 0.5 * scale,
                    right: 0.5 * scale,
                  }}
                />
              </Animated.View>
            </Animated.View>
          </View>

          {/* Cheeks */}
          <Animated.View
            style={[
              styles.cheeksContainer,
              {
                opacity: cheekOpacity,
              },
            ]}
          >
            <View
              style={{
                width: 8 * scale,
                height: 5 * scale,
                borderRadius: 4 * scale,
                backgroundColor: '#F4B8B8',
                opacity: 0.4,
                marginRight: eyeSpacing + 12 * scale,
              }}
            />
            <View
              style={{
                width: 8 * scale,
                height: 5 * scale,
                borderRadius: 4 * scale,
                backgroundColor: '#F4B8B8',
                opacity: 0.4,
                marginLeft: eyeSpacing + 12 * scale,
              }}
            />
          </Animated.View>

          {/* Mouth */}
          <Animated.View
            style={{
              transform: [
                { scaleX: mouthWidth },
              ],
            }}
          >
            <Animated.View
              style={{
                transform: [
                  { scaleY: mouthOpenness.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.8],
                  })},
                ],
              }}
            >
              <Svg width={24 * scale} height={12 * scale}>
                <Path
                  d={`M ${2 * scale} ${4 * scale} Q ${12 * scale} ${12 * scale} ${22 * scale} ${4 * scale}`}
                  stroke={featureColor}
                  strokeWidth={2 * scale}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
  },
  shadowOuter: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B7E74',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 14,
    // @ts-ignore - web-only property
    boxShadow: '0 6px 24px rgba(139, 126, 116, 0.28), 0 2px 8px rgba(139, 126, 116, 0.15)',
  },
  faceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  eyesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cheeksContainer: {
    position: 'absolute',
    flexDirection: 'row',
    bottom: '35%',
  },
});
