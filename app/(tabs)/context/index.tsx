import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User } from 'lucide-react-native';
import { useApp } from '@/providers/AppProvider';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

interface ContextFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  hint: string;
  colors: typeof Colors;
}

const ContextField: React.FC<ContextFieldProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  hint,
  colors,
}) => (
  <View style={styles.fieldContainer}>
    <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
    <Text style={[styles.fieldHint, { color: colors.textTertiary }]}>{hint}</Text>
    <TextInput
      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      multiline
      textAlignVertical="top"
    />
  </View>
);

export default function ContextScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, updateUserContext } = useApp();
  const { t } = useTranslation();

  const [name, setName] = useState(state.userContext.name || '');
  const [age, setAge] = useState(state.userContext.age || '');
  const [values, setValues] = useState(state.userContext.values);
  const [focus, setFocus] = useState(state.userContext.currentFocus);
  const [constraints, setConstraints] = useState(state.userContext.constraints);

  useEffect(() => {
    setName(state.userContext.name || '');
    setAge(state.userContext.age || '');
    setValues(state.userContext.values);
    setFocus(state.userContext.currentFocus);
    setConstraints(state.userContext.constraints);
  }, [state.userContext]);

  const handleNameChange = (text: string) => {
    setName(text);
    updateUserContext({ name: text });
  };

  const handleAgeChange = (text: string) => {
    setAge(text);
    updateUserContext({ age: text });
  };

  const handleValuesChange = (text: string) => {
    setValues(text);
    updateUserContext({ values: text });
  };

  const handleFocusChange = (text: string) => {
    setFocus(text);
    updateUserContext({ currentFocus: text });
  };

  const handleConstraintsChange = (text: string) => {
    setConstraints(text);
    updateUserContext({ constraints: text });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.accent + '30', shadowColor: colors.accent }]}>
          <View style={styles.profileCardHeader}>
            <View style={[styles.profileIconContainer, { backgroundColor: colors.accent + '15' }]}>
              <User size={24} color={colors.accent} />
            </View>
            <View style={styles.profileCardTitleContainer}>
              <Text style={[styles.profileCardTitle, { color: colors.text }]}>{t('context.aboutYou')}</Text>
              <Text style={[styles.profileCardSubtitle, { color: colors.textSecondary }]}>{t('context.aboutYouSubtitle')}</Text>
            </View>
          </View>
          <View style={styles.profileRow}>
            <View style={styles.profileField}>
              <Text style={[styles.profileLabel, { color: colors.textSecondary }]}>{t('context.name')}</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={name}
                onChangeText={handleNameChange}
                placeholder={t('context.namePlaceholder')}
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={[styles.profileField, styles.ageField]}>
              <Text style={[styles.profileLabel, { color: colors.textSecondary }]}>{t('context.age')}</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={age}
                onChangeText={handleAgeChange}
                placeholder={t('context.agePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionDivider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textTertiary }]}>{t('context.optionalContext')}</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <ContextField
          label={t('context.valuesLabel')}
          placeholder={t('context.valuesPlaceholder')}
          value={values}
          onChangeText={handleValuesChange}
          hint={t('context.valuesHint')}
          colors={colors}
        />

        <ContextField
          label={t('context.focusLabel')}
          placeholder={t('context.focusPlaceholder')}
          value={focus}
          onChangeText={handleFocusChange}
          hint={t('context.focusHint')}
          colors={colors}
        />

        <ContextField
          label={t('context.constraintsLabel')}
          placeholder={t('context.constraintsPlaceholder')}
          value={constraints}
          onChangeText={handleConstraintsChange}
          hint={t('context.constraintsHint')}
          colors={colors}
        />

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            {t('context.footer')}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },

  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  profileCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  profileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 14,
  },
  profileCardTitleContainer: {
    flex: 1,
  },
  profileCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  profileCardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 12,
  },
  profileRow: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  profileField: {
    flex: 1,
  },
  ageField: {
    flex: 0,
    width: 80,
  },
  profileLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  profileInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
  fieldContainer: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 100,
    lineHeight: 24,
  },
  footer: {
    marginTop: 16,
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
