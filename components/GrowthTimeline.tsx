import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { IconRenderer } from '@/components/IconRenderer';

export interface TimelineItem {
  id: string;
  icon: string;
  title: string;
  date: string;
  description?: string;
  type: 'goal' | 'insight' | 'streak' | 'milestone' | 'habit';
}

interface GrowthTimelineProps {
  items: TimelineItem[];
}

const TYPE_COLORS: Record<TimelineItem['type'], string> = {
  goal: '#7C9A82',
  insight: '#6366F1',
  streak: '#D4A574',
  milestone: '#C27070',
  habit: '#2DD4BF',
};

function TimelineNode({ item, index }: { item: TimelineItem; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    const delay = index * 150;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const color = TYPE_COLORS[item.type];

  return (
    <View style={styles.nodeContainer}>
      <View style={styles.lineSection}>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <IconRenderer name={item.icon} size={18} color={color} />
          <View style={styles.cardHeaderText}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.date}>{item.date}</Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function GrowthTimeline({ items }: GrowthTimelineProps) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Your journey starts here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      {items.map((item, index) => (
        <TimelineNode key={item.id} item={item} index={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingLeft: 6,
  },
  line: {
    position: 'absolute',
    left: 11,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#E8E8E6',
  },
  nodeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  lineSection: {
    width: 24,
    alignItems: 'center',
    paddingTop: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E6',
    padding: 14,
    marginLeft: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    color: '#9B9B9B',
  },
  description: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 8,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#9B9B9B',
    opacity: 0.7,
  },
});
