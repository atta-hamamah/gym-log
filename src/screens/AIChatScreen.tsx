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
  Modal,
} from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../components/Typography';
import { borderRadius } from '../theme/colors';
import { useAction, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Send, X, Bot, User, Sparkles, Zap } from 'lucide-react-native';
import { AIGeneratedWorkout } from '../types';
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
  const { userId: clerkUserId } = useAuth();
  const chatAction = useAction(api.ai.chat);
  const generateWorkoutAction = useAction(api.aiWorkout.generateWorkout);
  const [generating, setGenerating] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [userComment, setUserComment] = useState('');

  // Get Convex user from Clerk ID
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUserId ? { clerkId: clerkUserId } : "skip"
  );

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
        userId: convexUser._id as Id<"users">,
        message: userMessage.content,
        conversationHistory: history,
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
        content: t('aiChat.error'),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, convexUser, messages, chatAction, scrollToBottom, t]);

  // ── Show comment modal before generating ──
  const handleGenerateWorkoutPress = useCallback(() => {
    setUserComment('');
    setCommentModalVisible(true);
  }, []);

  // ── Generate workout handler ──
  const handleGenerateWorkout = useCallback(async () => {
    if (generating || !convexUser?._id) return;
    setCommentModalVisible(false);
    setGenerating(true);
    const comment = userComment.trim();
    try {
      const result = await generateWorkoutAction({
        userId: convexUser._id as Id<"users">,
        ...(comment ? { userComment: comment } : {}),
      });
      navigation.navigate('AIWorkoutPreview', {
        workout: result as AIGeneratedWorkout,
        ...(comment ? { userComment: comment } : {}),
      });
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: t('aiWorkout.errorMessage'),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setGenerating(false);
      setUserComment('');
    }
  }, [generating, convexUser, generateWorkoutAction, navigation, t, userComment]);

  // ── Render a single message bubble ──
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageBubbleRow, isUser && styles.messageBubbleRowUser]}>
        {!isUser && (
          <View style={styles.avatarAI}>
            <Bot color={colors.primary} size={18} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Typography
            variant="body"
            color={isUser ? '#fff' : colors.text}
            style={{ lineHeight: 22 }}
          >
            {item.content}
          </Typography>
        </View>
        {isUser && (
          <View style={styles.avatarUser}>
            <User color="#fff" size={16} />
          </View>
        )}
      </View>
    );
  }, []);

  // ── Render welcome state ──
  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeIcon}>
        <Sparkles color={colors.primary} size={40} />
      </View>
      <Typography variant="h2" align="center" style={{ marginTop: 16 }}>
        {t('aiChat.welcomeTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8, paddingHorizontal: 20 }}>
        {t('aiChat.welcomeDesc')}
      </Typography>

      {/* Suggestion chips */}
      <View style={styles.suggestionsContainer}>
        {[
          t('aiChat.suggestion1'),
          t('aiChat.suggestion2'),
          t('aiChat.suggestion3'),
          t('aiChat.suggestion4'),
        ].map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestionChip}
            onPress={() => {
              setInput(suggestion);
            }}
          >
            <Typography variant="caption" color={colors.primary}>
              {suggestion}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScreenLayout noPadding edges={['top', 'left', 'right']}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Bot color={colors.primary} size={22} />
            </View>
            <View>
              <Typography variant="h3">RepAI</Typography>
              <Typography variant="caption" color={colors.textSecondary}>
                {t('aiChat.subtitle')}
              </Typography>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[styles.generateButton, generating && { opacity: 0.6 }]}
              onPress={handleGenerateWorkoutPress}
              disabled={generating}
              activeOpacity={0.7}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <>
                  <Zap color="#8B5CF6" size={16} />
                  <Typography variant="caption" color="#8B5CF6" bold style={{ marginLeft: 4, fontSize: 11 }}>
                    {t('aiWorkout.generateBtn')}
                  </Typography>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <X color={colors.textSecondary} size={22} />
            </TouchableOpacity>
          </View>
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
                <Bot color={colors.primary} size={18} />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Typography variant="caption" color={colors.textSecondary} style={{ marginLeft: 8 }}>
                  {t('aiChat.thinking')}
                </Typography>
              </View>
            </View>
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
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
              style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || loading}
            >
              <Send color={input.trim() && !loading ? '#fff' : colors.textMuted} size={20} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.commentModalOverlay}>
          <View style={styles.commentModalCard}>
            <Typography variant="h2" style={{ marginBottom: 4 }}>{t('aiWorkout.commentTitle')}</Typography>
            <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 16 }}>
              {t('aiWorkout.commentDesc')}
            </Typography>

            <TextInput
              style={styles.commentInput}
              placeholder={t('aiWorkout.commentPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={userComment}
              onChangeText={setUserComment}
              multiline
              maxLength={300}
              autoFocus
            />

            <View style={styles.commentModalButtons}>
              <TouchableOpacity
                style={styles.commentCancelBtn}
                onPress={() => { setCommentModalVisible(false); setUserComment(''); }}
                activeOpacity={0.7}
              >
                <Typography variant="body" color={colors.textSecondary}>{t('common.cancel')}</Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentGenerateBtn}
                onPress={handleGenerateWorkout}
                activeOpacity={0.7}
              >
                <Sparkles color="#fff" size={16} />
                <Typography variant="body" color="#fff" bold style={{ marginLeft: 6 }}>
                  {t('aiWorkout.generate')}
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
};

// ── Styles ────────────────────────────────────────────────
const createStyles = (colors: any, bottomInset: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6' + '12',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#8B5CF6' + '25',
  },
  chatArea: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '85%',
  },
  messageBubbleRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '100%',
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.surfaceLight,
    borderBottomLeftRadius: 4,
  },
  avatarAI: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarUser: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Math.max(40, bottomInset),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 16,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    paddingHorizontal: 24,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 12,
  },
  suggestionChip: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '25',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  // Comment Modal
  commentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  commentModalCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.l,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentInput: {
    minHeight: 80,
    maxHeight: 120,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
  },
  commentModalButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  commentCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: borderRadius.m,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentGenerateBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.m,
    backgroundColor: '#8B5CF6',
  },
});
