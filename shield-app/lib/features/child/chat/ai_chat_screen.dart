import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_client.dart';

class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({super.key});
  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _messages = <_ChatMessage>[];
  final _input    = TextEditingController();
  final _scroll   = ScrollController();
  bool _sending   = false;

  @override
  void initState() {
    super.initState();
    _messages.add(const _ChatMessage(
      text:  'Hi! I\'m your Shield AI assistant. I can help you with homework, answer questions, '
             'or just chat. What\'s on your mind today?',
      isBot: true,
    ));
  }

  @override
  void dispose() { _input.dispose(); _scroll.dispose(); super.dispose(); }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() {
      _messages.add(_ChatMessage(text: text, isBot: false));
      _sending = true;
    });
    _input.clear();
    _scrollToBottom();

    try {
      final resp = await ApiClient.instance.post('/ai/chat', data: {'message': text});
      final reply = (resp.data as Map<String, dynamic>?)?['reply']?.toString()
          ?? 'I\'m here to help! Could you rephrase that?';
      setState(() {
        _messages.add(_ChatMessage(text: reply, isBot: true));
        _sending = false;
      });
    } catch (_) {
      setState(() {
        _messages.add(const _ChatMessage(
          text:  'Sorry, I couldn\'t connect right now. Try again in a moment.',
          isBot: true,
        ));
        _sending = false;
      });
    }
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve:    Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF1E40AF),
    appBar: AppBar(
      backgroundColor: Colors.transparent,
      foregroundColor: Colors.white,
      title: const Text('AI Assistant'),
      leading: IconButton(
        icon:      const Icon(Icons.arrow_back),
        onPressed: () => context.pop(),
      ),
    ),
    body: Column(children: [
      // Messages
      Expanded(
        child: ListView.builder(
          controller:  _scroll,
          padding:     const EdgeInsets.all(16),
          itemCount:   _messages.length,
          itemBuilder: (_, i) => _BubbleWidget(msg: _messages[i]),
        ),
      ),

      // Typing indicator
      if (_sending)
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              SizedBox(width: 24, height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white54)),
              SizedBox(width: 8),
              Text('Thinking…', style: TextStyle(color: Colors.white38, fontSize: 12)),
            ]),
          ),
        ),

      // Input
      Container(
        color: Colors.black26,
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: _input,
              style:      const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText:    'Ask anything…',
                hintStyle:   const TextStyle(color: Colors.white38),
                filled:      true,
                fillColor:   Colors.white.withOpacity(0.08),
                border:      OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onSubmitted: (_) => _send(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: _sending ? null : _send,
            icon: const Icon(Icons.send_rounded, color: Color(0xFF64B5F6)),
          ),
        ]),
      ),
    ]),
  );
}

class _ChatMessage {
  const _ChatMessage({required this.text, required this.isBot});
  final String text;
  final bool   isBot;
}

class _BubbleWidget extends StatelessWidget {
  const _BubbleWidget({required this.msg});
  final _ChatMessage msg;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      mainAxisAlignment: msg.isBot ? MainAxisAlignment.start : MainAxisAlignment.end,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (msg.isBot) ...[
          const CircleAvatar(
            radius:          16,
            backgroundColor: Color(0xFF2563EB),
            child: Icon(Icons.psychology, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: msg.isBot
                  ? Colors.white.withOpacity(0.12)
                  : const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(18).copyWith(
                bottomLeft:  msg.isBot ? const Radius.circular(4) : null,
                bottomRight: !msg.isBot ? const Radius.circular(4) : null,
              ),
            ),
            child: Text(msg.text, style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4)),
          ),
        ),
      ],
    ),
  );
}
