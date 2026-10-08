import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../components/Typography';
import { borderRadius, ThemeColors } from '../theme/colors';
import { useAction, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../../convex/_generated/api';
import { useSubscription } from '../context/SubscriptionContext';
import { ArrowUp, Sparkles, MessageCircle } from 'lucide-react-native';
import { ForwardChevron } from '../components/DirectionalIcons';
import { Button } from '../components/Button';
import { AIGeneratedWorkout } from '../types';
import { useWorkout } from '../context/WorkoutContext';
import { toCloudWorkout } from '../services/cloudSync';
import { GenerateWorkoutOptions, GenerateWorkoutSheet } from '../components/GenerateWorkoutSheet';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const AIChatScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.bottom);
  const chatAction = useAction(api.ai.chat);
  const generateWorkoutAction = useAction(api.aiWorkout.generateWorkout);
  const [generating, setGenerating] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const { currentWorkout } = useWorkout();

  // Signed-in user's cloud profile (the AI actions resolve the user from auth)
  const convexUser = useQuery(api.users.me);
  const { refreshSubscriptionState } = useSubscription();

  // The server rejected the request because the subscription isn't active
  // (e.g. expired or refunded): re-check with the store so the app updates.
  const subscriptionErrorText = useCallback((error: unknown): string | null => {
    if (error instanceof ConvexError && (error.data as any)?.code === 'AI_SUBSCRIPTION_REQUIRED') {
      refreshSubscriptionState();
      return t('aiChat.subscriptionRequired');
    }
    return null;
  }, [refreshSubscriptionState, t]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [colors]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || !convexUser?._id) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      // Build conversation history for context
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await chatAction({
        message: userMessage.content,
        conversationHistory: history,
        // The coach also sees the workout in progress (it's only on the device until finished).
        ...(currentWorkout ? { activeWorkout: toCloudWorkout(currentWorkout) } : {}),
      });

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
      scrollToBottom();
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: subscriptionErrorText(error) ?? t('aiChat.error'),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, convexUser, messages, chatAction, scrollToBottom, t, subscriptionErrorText, currentWorkout]);

  // ── Show options sheet before generating ──
  const handleGenerateWorkoutPress = useCallback(() => {
    setCommentModalVisible(true);
  }, []);

  // ── Generate workout handler ──
  const handleGenerateWorkout = useCallback(async (options: GenerateWorkoutOptions) => {
    if (generating || !convexUser?._id) return;
    setCommentModalVisible(false);
    setGenerating(true);
    try {
      const result = await generateWorkoutAction(options);
      navigation.navigate('AIWorkoutPreview', {
        workout: result as AIGeneratedWorkout,
        options,
      });
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: subscriptionErrorText(error) ?? t('aiWorkout.errorMessage'),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setGenerating(false);
    }
  }, [generating, convexUser, generateWorkoutAction, navigation, t, subscriptionErrorText]);

  // ── Render a single message bubble ──
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.avatarAI}>
            <Sparkles color={colors.secondary} size={15} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Typography
            variant="body"
            color={isUser ? colors.onPrimary : colors.text}
            style={{ lineHeight: 22 }}
          >
            {item.content}
          </Typography>
        </View>
      </View>
    );
  }, [colors, styles]);

  // ── Render welcome state ──
  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeIcon}>
        <Sparkles color={colors.secondary} size={30} />
      </View>
      <Typography variant="h2" align="center" style={{ marginTop: 18 }}>
        {t('aiChat.welcomeTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 6, paddingHorizontal: 12 }}>
        {t('aiChat.welcomeDesc')}
      </Typography>

      {/* Suggested prompts */}
      <View style={styles.suggestions}>
        {[
          t('aiChat.suggestion1'),
          t('aiChat.suggestion2'),
          t('aiChat.suggestion3'),
          t('aiChat.suggestion4'),
        ].map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestion}
            onPress={() => setInput(suggestion)}
            activeOpacity={0.7}
          >
            <MessageCircle color={colors.textMuted} size={16} />
            <Typography variant="bodySmall" color={colors.text} style={{ flex: 1 }}>
              {suggestion}
            </Typography>
            <ForwardChevron color={colors.textMuted} size={16} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const canSend = !!input.trim() && !loading;

  return (
    <ScreenLayout noPadding edges={['top', 'left', 'right']}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Sparkles color={colors.secondary} size={20} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Typography variant="h3">RepAI</Typography>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Typography variant="caption" color={colors.textSecondary} numberOfLines={1}>
                  {t('aiChat.subtitle')}
                </Typography>
              </View>
            </View>
          </View>
          <Button
            title={t('aiWorkout.generateBtn')}
            variant="ai"
            size="small"
            loading={generating}
            icon={c => <Sparkles color={c} size={15} />}
            onPress={handleGenerateWorkoutPress}
            disabled={generating}
          />
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {messages.length === 0 ? (
            renderWelcome()
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Typing indicator */}
          {loading && (
            <View style={styles.typingContainer}>
              <View style={styles.avatarAI}>
                <Sparkles color={colors.secondary} size={15} />
              </View>
              <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
                <ActivityIndicator size="small" color={colors.secondary} />
                <Typography variant="caption" color={colors.textSecondary}>
                  {t('aiChat.thinking')}
                </Typography>
              </View>
            </View>
          )}

          {/* Composer */}
          <View style={styles.inputBar}>
            <View style={styles.composer}>
              <TextInput
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder={t('aiChat.placeholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                editable={!loading}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t('aiChat.send', 'Send')}
              >
                <ArrowUp color={canSend ? colors.onPrimary : colors.textMuted} size={19} strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Generate options */}
      <GenerateWorkoutSheet
        visible={commentModalVisible}
        onCancel={() => setCommentModalVisible(false)}
        onGenerate={handleGenerateWorkout}
      />
    </ScreenLayout>
  );
};

// ── Styles ────────────────────────────────────────────────
const createStyles = (colors: ThemeColors, bottomInset: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.secondarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  chatArea: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '88%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '100%',
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  avatarAI: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Math.max(14, bottomInset),
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
  },
  textInput: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 9,
    fontSize: 16,
    color: colors.text,
    maxHeight: 110,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  // Welcome state
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.secondarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestions: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 28,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.m,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
});
