import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';

class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({super.key});
  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final List<ChatMessage> _messages = [];
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isLoading = false;
  String? _profileId;

  @override
  void initState() {
    super.initState();
    _loadProfileId();
    _addSystemMessage();
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _addSystemMessage() {
    _messages.add(ChatMessage(
      text: "Hi! I'm your Learning Buddy! 🌟 I'm here to help with homework, science, math, history, and more. What would you like to learn today?",
      isUser: false,
      timestamp: DateTime.now(),
    ));
  }

  Future<void> _loadProfileId() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) setState(() => _profileId = prefs.getString('profile_id'));
  }

  Future<void> _sendMessage() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _isLoading) return;

    _inputController.clear();
    final userMessage = ChatMessage(text: text, isUser: true, timestamp: DateTime.now());
    setState(() {
      _messages.add(userMessage);
      _isLoading = true;
    });
    _scrollToBottom();

    try {
      final client = ref.read(dioProvider);

      // Build conversation history (last 20 messages, skip the initial greeting)
      final history = _messages
          .skip(1) // skip the greeting message
          .take(20)
          .map((m) => {'role': m.isUser ? 'user' : 'assistant', 'content': m.text})
          .toList();

      final response = await client.post(
        '/ai/chat',
        data: {
          'profileId': _profileId ?? '',
          'question': text,
          'ageGroup': 'child',
          'conversationHistory': history,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>? ?? {};
        final inner = data['data'] as Map<String, dynamic>? ?? data;
        final reply = (inner['reply'] as String?) ??
            (inner['answer'] as String?) ??
            "I'm having trouble responding right now. Try again!";
        setState(() => _messages.add(ChatMessage(
          text: reply,
          isUser: false,
          timestamp: DateTime.now(),
        )));
      }
    } on Exception catch (_) {
      setState(() => _messages.add(ChatMessage(
        text: "I can't connect right now. Check your internet and try again!",
        isUser: false,
        timestamp: DateTime.now(),
      )));
    } finally {
      if (mounted) setState(() => _isLoading = false);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.smart_toy, color: Colors.white),
            SizedBox(width: 8),
            Text('Learning Buddy', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ],
        ),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Subtle info banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFFE3F2FD),
            child: Row(
              children: [
                const Icon(Icons.verified_user, size: 14, color: Color(0xFF1565C0)),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text(
                    'Safe mode active — educational topics only',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF1565C0),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Messages list
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              itemCount: _messages.length + (_isLoading ? 1 : 0),
              itemBuilder: (ctx, i) {
                if (i == _messages.length) return const _TypingIndicator();
                return _MessageBubble(message: _messages[i]);
              },
            ),
          ),

          // Input bar
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(20),
                  blurRadius: 8,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      decoration: InputDecoration(
                        hintText: 'Ask me anything...',
                        hintStyle: TextStyle(color: Colors.grey.shade400),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: const BorderSide(color: Color(0xFF1565C0), width: 1.5),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        filled: true,
                        fillColor: Colors.grey.shade50,
                      ),
                      onSubmitted: (_) => _sendMessage(),
                      enabled: !_isLoading,
                      textInputAction: TextInputAction.send,
                      maxLines: null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    child: Material(
                      color: _isLoading ? Colors.grey.shade300 : const Color(0xFF1565C0),
                      borderRadius: BorderRadius.circular(24),
                      child: InkWell(
                        onTap: _isLoading ? null : _sendMessage,
                        borderRadius: BorderRadius.circular(24),
                        child: const Padding(
                          padding: EdgeInsets.all(12),
                          child: Icon(Icons.send_rounded, color: Colors.white, size: 20),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Data model ────────────────────────────────────────────────────────────────

class ChatMessage {
  final String text;
  final bool isUser;
  final DateTime timestamp;

  const ChatMessage({
    required this.text,
    required this.isUser,
    required this.timestamp,
  });
}

// ── Message bubble ────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final ChatMessage message;

  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isUser) ...[
            const CircleAvatar(
              radius: 16,
              backgroundColor: Color(0xFFBBDEFB),
              child: Icon(Icons.smart_toy, size: 18, color: Color(0xFF1565C0)),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.72,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isUser ? const Color(0xFF1565C0) : Colors.grey.shade100,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(isUser ? 18 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 18),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha(12),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Text(
                message.text,
                style: TextStyle(
                  color: isUser ? Colors.white : Colors.black87,
                  fontSize: 15,
                  height: 1.4,
                ),
              ),
            ),
          ),
          if (isUser) const SizedBox(width: 8),
        ],
      ),
    );
  }
}

// ── Typing indicator ─────────────────────────────────────────────────────────

class _TypingIndicator extends StatefulWidget {
  const _TypingIndicator();

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.3, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const CircleAvatar(
            radius: 16,
            backgroundColor: Color(0xFFBBDEFB),
            child: Icon(Icons.smart_toy, size: 18, color: Color(0xFF1565C0)),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(18),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(3, (i) {
                return AnimatedBuilder(
                  animation: _animation,
                  builder: (_, __) {
                    // Offset each dot's phase
                    final delay = i * 0.15;
                    final value = (((_controller.value + delay) % 1.0));
                    final opacity = value < 0.5
                        ? 0.3 + (value / 0.5) * 0.7
                        : 1.0 - ((value - 0.5) / 0.5) * 0.7;
                    return Opacity(
                      opacity: opacity.clamp(0.3, 1.0),
                      child: Container(
                        margin: EdgeInsets.only(right: i < 2 ? 4 : 0),
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFF1565C0),
                          shape: BoxShape.circle,
                        ),
                      ),
                    );
                  },
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}
