# Pre-rendered interview clips

Each interviewer directory contains the same eight fixed questions with embedded
audio. Files are reused for every interview; runtime question generation is not
required.

Required layout:

```text
interview-officers/
  miller/question-01.mp4 ... question-08.mp4
  chen/question-01.mp4 ... question-08.mp4
  obama/question-01.mp4 ... question-08.mp4
```

The first release contains three selectable virtual officers and 24 reusable clips in total.

Questions:

1. 你去美国做什么？
2. 你准备去哪些城市？
3. 你准备在美国待多久？
4. 谁和你一起去？
5. 你在美国住哪里？
6. 这次旅行谁承担费用？
7. 你现在做什么工作？
8. 旅行结束后你回来做什么？

Encode as H.264 video plus AAC audio in MP4. Keep the same framing and
resolution across every clip. The Obama simulation must use a licensed,
non-imitative male voice unless explicit voice rights are available.
