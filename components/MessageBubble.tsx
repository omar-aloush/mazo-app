import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/providers/ThemeProvider';
import { Message } from '@/types';
import * as Haptics from 'expo-haptics';

interface MessageBubbleProps {
  message: Message;
  coachName?: string;
}

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  message,
  coachName,
}) => {
  const isUser = message.role === 'user';
  const { colors, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 12 : -12)).current;
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 10,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleLongPress = useCallback(async () => {
    Haptics.selectionAsync().catch(() => { });
    await Clipboard.setStringAsync(message.content);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 1200);
  }, [message.content]);

  // Enhanced markdown renderer: bold, italic, inline code, bullet lists, numbered lists
  const renderFormattedText = (text: string, textColor: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        elements.push(<Text key={`br-${lineIndex}`}>{'\n'}</Text>);
      }

      // Check for bullet points
      const bulletMatch = line.match(/^(\s*)([-•*])\s+(.*)/);
      if (bulletMatch) {
        const indent = bulletMatch[1].length;
        const content = bulletMatch[3];
        elements.push(
          <Text key={`bullet-${lineIndex}`} style={{ color: textColor }}>
            {'  '.repeat(Math.floor(indent / 2))}{'  •  '}
            {renderInlineFormatting(content, textColor, `bl-${lineIndex}`)}
          </Text>
        );
        return;
      }

      // Check for numbered lists
      const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        const indent = numberedMatch[1].length;
        const num = numberedMatch[2];
        const content = numberedMatch[3];
        elements.push(
          <Text key={`num-${lineIndex}`} style={{ color: textColor }}>
            {'  '.repeat(Math.floor(indent / 2))}{`  ${num}.  `}
            {renderInlineFormatting(content, textColor, `nl-${lineIndex}`)}
          </Text>
        );
        return;
      }

      // Regular text with inline formatting
      elements.push(
        <React.Fragment key={`line-${lineIndex}`}>
          {renderInlineFormatting(line, textColor, `ln-${lineIndex}`)}
        </React.Fragment>
      );
    });

    return elements;
  };

  // Parse inline formatting: **bold**, *italic*, `code`
  const renderInlineFormatting = (text: string, textColor: string, keyPrefix: string) => {
    // Match bold (**text**), italic (*text*), and inline code (`text`)
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return (
          <Text key={`${keyPrefix}-${index}`} style={{ fontWeight: '700', color: textColor }}>
            {boldText}
          </Text>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        const italicText = part.slice(1, -1);
        return (
          <Text key={`${keyPrefix}-${index}`} style={{ fontStyle: 'italic', color: textColor }}>
            {italicText}
          </Text>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const codeText = part.slice(1, -1);
        return (
          <Text
            key={`${keyPrefix}-${index}`}
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              backgroundColor: isUser
                ? 'rgba(255,255,255,0.15)'
                : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
              color: textColor,
              paddingHorizontal: 2,
              borderRadius: 3,
            }}
          >
            {codeText}
          </Text>
        );
      }
      return <Text key={`${keyPrefix}-${index}`}>{part}</Text>;
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.coachContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
      testID={`message-${message.id}`}
    >
      {!isUser && coachName && (
        <Text style={[styles.coachLabel, { color: colors.textTertiary }]}>{coachName}</Text>
      )}
      <Pressable onLongPress={handleLongPress} style={{ maxWidth: '80%' }}>
        <View style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.userBubble }]
            : [styles.coachBubble, {
              backgroundColor: colors.coachBubble,
              // Subtle shadow for depth on coach bubbles
              ...(isDark ? {} : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 1,
              }),
            }],
        ]}>
          <Text style={[
            styles.text,
            isUser
              ? { color: colors.textInverse }
              : { color: colors.text },
          ]}>
            {isUser ? message.content : renderFormattedText(message.content, isUser ? colors.textInverse : colors.text)}
          </Text>
        </View>
      </Pressable>
      {showCopied && (
        <Animated.View style={[styles.copiedToast, { backgroundColor: colors.surface }]}>
          <Text style={[styles.copiedText, { color: colors.textSecondary }]}>Copied</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

export const MessageBubble = React.memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
    width: '100%',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  coachContainer: {
    alignItems: 'flex-start',
  },
  coachLabel: {
    fontSize: 11,
    marginBottom: 3,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600' as const,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userBubble: {
    borderBottomRightRadius: 6,
  },
  coachBubble: {
    borderBottomLeftRadius: 6,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  copiedToast: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  copiedText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
});
