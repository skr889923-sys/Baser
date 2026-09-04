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
    background: highContrast ? '#050505' : '#071013',
    backgroundRaised: highContrast ? '#0b0b0b' : '#0b171b',
    surface: highContrast ? '#111111' : '#101c21',
    raised: highContrast ? '#191919' : '#17282e',
    mutedSurface: highContrast ? '#0a0a0a' : '#0c181c',
    border: highContrast ? '#f4e04d' : '#315561',
    borderSoft: highContrast ? '#555018' : '#203a42',
    text: '#f8fafc',
    textMuted: highContrast ? '#f4e04d' : '#b5c7cd',
    textSoft: highContrast ? '#e7e0a2' : '#78929b',
    accent: highContrast ? '#f4e04d' : '#62c3bd',
    accentDark: highContrast ? '#0f0f0f' : '#103c43',
    accentSoft: highContrast ? '#27240a' : '#153139',
    success: highContrast ? '#f4e04d' : '#57cc99',
    danger: highContrast ? '#ff6b6b' : '#ef6a67',
    dangerSurface: highContrast ? '#2b0b0b' : '#34191b',
    warning: highContrast ? '#f4e04d' : '#e0b65d',
    shadow: highContrast ? '#000000' : '#02080b',
    buttonText: highContrast ? '#050505' : '#062224',
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
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View
        style={[
          shellStyles.ambientOrb,
          { backgroundColor: theme.accentSoft },
        ]}
        accessible={false}
      />
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
    <View
      style={[
        componentStyles.hero,
        surfaceStyle(theme),
        shadowStyle(theme.shadow, 'hero'),
        { backgroundColor: theme.backgroundRaised },
      ]}
    >
      <View
        style={[
          componentStyles.heroAccent,
          { backgroundColor: theme.accent },
        ]}
        accessible={false}
      />
      <View style={componentStyles.heroTop}>
        <View style={componentStyles.eyebrowGroup}>
          <View style={componentStyles.waveform} accessible={false}>
            {[8, 16, 11, 20].map((height, index) => (
              <View
                key={`${height}-${index}`}
                style={[
                  componentStyles.waveBar,
                  { height, backgroundColor: theme.accent },
                ]}
              />
            ))}
          </View>
          <Text style={[componentStyles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
        </View>
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
      <View style={componentStyles.glyphSignal}>
        <View style={[componentStyles.glyphDot, { backgroundColor: color }]} />
        <View style={[componentStyles.glyphLine, { backgroundColor: color }]} />
      </View>
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
        },
        shadowStyle(theme.shadow, 'tile'),
      ]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      activeOpacity={0.8}
    >
      <View style={componentStyles.tileHeader}>
        <SignalGlyph label={label} theme={theme} danger={danger} />
        <View
          style={[
            componentStyles.tileArrow,
            { borderColor, backgroundColor: theme.mutedSurface },
          ]}
          accessible={false}
        >
          <Text style={[componentStyles.tileArrowText, { color: danger ? theme.danger : theme.accent }]}>
            ←
          </Text>
        </View>
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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      activeOpacity={0.8}
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

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  meta?: string;
  theme: InterfaceTheme;
};

export function SectionHeader({ title, eyebrow, meta, theme }: SectionHeaderProps) {
  return (
    <View style={componentStyles.sectionHeader}>
      <View style={componentStyles.sectionCopy}>
        {eyebrow ? (
          <Text style={[componentStyles.sectionEyebrow, { color: theme.accent }]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={[componentStyles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {meta ? (
        <Text style={[componentStyles.sectionMeta, { color: theme.textSoft }]}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

type StatePanelProps = {
  code: string;
  title: string;
  description: string;
  theme: InterfaceTheme;
  tone?: 'normal' | 'danger' | 'warning';
  actionTitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StatePanel({
  code,
  title,
  description,
  theme,
  tone = 'normal',
  actionTitle,
  actionLabel,
  onAction,
}: StatePanelProps) {
  const danger = tone === 'danger';
  const toneColor = danger ? theme.danger : tone === 'warning' ? theme.warning : theme.accent;

  return (
    <View
      style={[
        componentStyles.statePanel,
        surfaceStyle(theme),
        { borderColor: toneColor },
      ]}
      accessibilityRole={danger ? 'alert' : undefined}
    >
      <SignalGlyph label={code} theme={theme} danger={danger} />
      <Text style={[componentStyles.stateTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[componentStyles.stateDescription, { color: theme.textMuted }]}>
        {description}
      </Text>
      {actionTitle && actionLabel && onAction ? (
        <PrimaryButton
          title={actionTitle}
          theme={theme}
          onPress={onAction}
          variant="secondary"
          accessibilityLabel={actionLabel}
        />
      ) : null}
    </View>
  );
}

export function surfaceStyle(theme: InterfaceTheme): ViewStyle {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.borderSoft,
  };
}

function shadowStyle(color: string, variant: 'hero' | 'tile'): ViewStyle {
  if (Platform.OS === 'web') {
    const shadow =
      variant === 'hero'
        ? `0 18px 52px ${color}66`
        : `0 12px 36px ${color}52`;

    return { boxShadow: shadow } as ViewStyle;
  }

  return variant === 'hero'
    ? {
        shadowColor: color,
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.2,
        shadowRadius: 28,
        elevation: 4,
      }
    : {
        shadowColor: color,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
        elevation: 3,
      };
}

const shellStyles = StyleSheet.create({
  content: {
    flexGrow: 1,
    minHeight: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  padded: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 34,
  },
  frame: {
    width: '100%',
    alignSelf: 'center',
    zIndex: 1,
    ...(Platform.OS === 'web' ? { maxWidth: 820 } : null),
  },
  ambientOrb: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.34,
  },
});

const componentStyles = StyleSheet.create({
  hero: {
    borderWidth: 1.5,
    borderRadius: 30,
    paddingHorizontal: 23,
    paddingTop: 24,
    paddingBottom: 28,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroAccent: {
    position: 'absolute',
    top: 0,
    right: 28,
    width: 72,
    height: 3,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  eyebrowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  waveform: {
    minWidth: 34,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 10,
  },
  waveBar: {
    width: 3,
    borderRadius: 3,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 37,
    lineHeight: 44,
    fontWeight: '900',
    textAlign: 'auto',
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 27,
    fontWeight: '600',
    textAlign: 'auto',
  },
  glyph: {
    minWidth: 60,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  glyphDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  glyphLine: {
    width: 18,
    height: 2,
    borderRadius: 2,
    marginLeft: 4,
    opacity: 0.68,
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
    borderRadius: 25,
    padding: 19,
    marginBottom: 14,
    minHeight: 146,
    justifyContent: 'space-between',
  },
  compactTile: {
    minHeight: 112,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tileArrow: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileArrowText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  tileTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'auto',
  },
  tileSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'auto',
  },
  button: {
    width: '100%',
    minHeight: 60,
    borderRadius: 19,
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
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 10,
    marginBottom: 14,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    textAlign: 'auto',
  },
  sectionMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'auto',
  },
  statePanel: {
    borderWidth: 1.5,
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  stateTitle: {
    marginTop: 18,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateDescription: {
    marginTop: 9,
    marginBottom: 18,
    maxWidth: 430,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
});
