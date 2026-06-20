import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

export type InterfaceTheme = ReturnType<typeof getInterfaceTheme>;

export function getInterfaceTheme(highContrast: boolean) {
  return {
    highContrast,
    background: highContrast ? '#050505' : '#091114',
    surface: highContrast ? '#111111' : '#111b20',
    raised: highContrast ? '#191919' : '#17262c',
    mutedSurface: highContrast ? '#0a0a0a' : '#0d171b',
    border: highContrast ? '#f4e04d' : '#284653',
    borderSoft: highContrast ? '#555018' : '#213942',
    text: '#f8fafc',
    textMuted: highContrast ? '#f4e04d' : '#a8bac2',
    textSoft: highContrast ? '#e7e0a2' : '#718891',
    accent: highContrast ? '#f4e04d' : '#38a3a5',
    accentDark: highContrast ? '#0f0f0f' : '#0f4c5c',
    success: highContrast ? '#f4e04d' : '#57cc99',
    danger: '#e05757',
    dangerSurface: '#351617',
    warning: '#e2b75d',
    shadow: highContrast ? '#000000' : '#020617',
    buttonText: highContrast ? '#050505' : '#ffffff',
  };
}

type ScreenShellProps = {
  children: React.ReactNode;
  highContrast: boolean;
  padded?: boolean;
};

export function ScreenShell({ children, highContrast, padded = true }: ScreenShellProps) {
  const theme = getInterfaceTheme(highContrast);
  return (
    <ScrollView
      contentContainerStyle={[
        shellStyles.content,
        { backgroundColor: theme.background },
        padded && shellStyles.padded,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={shellStyles.frame}>{children}</View>
    </ScrollView>
  );
}

type HeroPanelProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  code?: string;
  theme: InterfaceTheme;
};

export function HeroPanel({ eyebrow, title, subtitle, code = 'BASEERA', theme }: HeroPanelProps) {
  return (
    <View style={[componentStyles.hero, surfaceStyle(theme)]}>
      <View style={componentStyles.heroTop}>
        <Text style={[componentStyles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
        <SignalGlyph theme={theme} label={code} />
      </View>
      <Text style={[componentStyles.heroTitle, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text style={[componentStyles.heroSubtitle, { color: theme.textMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

type SignalGlyphProps = {
  label: string;
  theme: InterfaceTheme;
  danger?: boolean;
};

export function SignalGlyph({ label, theme, danger = false }: SignalGlyphProps) {
  const color = danger ? theme.danger : theme.accent;
  return (
    <View
      style={[
        componentStyles.glyph,
        {
          borderColor: color,
          backgroundColor: danger ? theme.dangerSurface : theme.mutedSurface,
        },
      ]}
      accessible={false}
    >
      <View style={[componentStyles.glyphDot, { backgroundColor: color }]} />
      <Text style={[componentStyles.glyphText, { color }]}>{label}</Text>
    </View>
  );
}

type ActionTileProps = {
  title: string;
  subtitle?: string;
  label: string;
  theme: InterfaceTheme;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  selected?: boolean;
  danger?: boolean;
  compact?: boolean;
};

export function ActionTile({
  title,
  subtitle,
  label,
  theme,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  selected = false,
  danger = false,
  compact = false,
}: ActionTileProps) {
  const borderColor = danger ? theme.danger : selected ? theme.accent : theme.borderSoft;
  const backgroundColor = danger ? theme.dangerSurface : selected ? theme.accentDark : theme.surface;
  return (
    <TouchableOpacity
      style={[
        componentStyles.tile,
        compact && componentStyles.compactTile,
        {
          backgroundColor,
          borderColor,
          shadowColor: theme.shadow,
        },
      ]}
      onPress={onPress}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      activeOpacity={0.82}
    >
      <View style={componentStyles.tileHeader}>
        <SignalGlyph label={label} theme={theme} danger={danger} />
      </View>
      <Text style={[componentStyles.tileTitle, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[componentStyles.tileSubtitle, { color: theme.textMuted }]} numberOfLines={3}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

type PrimaryButtonProps = {
  title: string;
  theme: InterfaceTheme;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
};

export function PrimaryButton({
  title,
  theme,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'primary',
  disabled = false,
}: PrimaryButtonProps) {
  const buttonStyle = {
    primary: { backgroundColor: theme.accent, borderColor: theme.accent },
    secondary: { backgroundColor: theme.raised, borderColor: theme.border },
    danger: { backgroundColor: theme.danger, borderColor: theme.danger },
    ghost: { backgroundColor: 'transparent', borderColor: theme.border },
  }[variant];

  const textColor = variant === 'primary' ? theme.buttonText : theme.text;

  return (
    <TouchableOpacity
      style={[
        componentStyles.button,
        buttonStyle,
        disabled && componentStyles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.82}
    >
      <Text style={[componentStyles.buttonText, { color: textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  theme: InterfaceTheme;
  tone?: 'normal' | 'warning' | 'danger' | 'success';
};

export function MetricCard({ label, value, theme, tone = 'normal' }: MetricCardProps) {
  const color = tone === 'danger'
    ? theme.danger
    : tone === 'warning'
      ? theme.warning
      : tone === 'success'
        ? theme.success
        : theme.accent;

  return (
    <View style={[componentStyles.metric, surfaceStyle(theme), { borderColor: color }]}>
      <Text style={[componentStyles.metricValue, { color }]}>{value}</Text>
      <Text style={[componentStyles.metricLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

type StatusPillProps = {
  text: string;
  theme: InterfaceTheme;
  tone?: 'normal' | 'success' | 'danger' | 'warning';
};

export function StatusPill({ text, theme, tone = 'normal' }: StatusPillProps) {
  const color = tone === 'danger'
    ? theme.danger
    : tone === 'warning'
      ? theme.warning
      : tone === 'success'
        ? theme.success
        : theme.accent;

  return (
    <View style={[componentStyles.pill, { borderColor: color, backgroundColor: theme.mutedSurface }]}>
      <View style={[componentStyles.pillDot, { backgroundColor: color }]} />
      <Text style={[componentStyles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export function surfaceStyle(theme: InterfaceTheme): ViewStyle {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.borderSoft,
    shadowColor: theme.shadow,
  };
}

const shellStyles = StyleSheet.create({
  content: {
    flexGrow: 1,
    minHeight: '100%',
  },
  padded: {
    padding: 18,
  },
  frame: {
    width: '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? { maxWidth: 820 } : null),
  },
});

const componentStyles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '900',
    textAlign: 'left',
  },
  heroSubtitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
  },
  glyph: {
    minWidth: 58,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  glyphText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tile: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    minHeight: 142,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 3,
  },
  compactTile: {
    minHeight: 108,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 14,
  },
  tileTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  tileSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  button: {
    width: '100%',
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.42,
  },
  metric: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 5,
    minHeight: 104,
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  metricLabel: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
});
