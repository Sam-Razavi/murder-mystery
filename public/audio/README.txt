Soundtrack (plays on the TV only)
=================================

Drop your song(s) in this folder:

  theme.mp3   the main track. Loops quietly through the lobby and the game,
              and gets quieter or louder with the mood of each phase.
  intro.mp3   optional: a separate track for the ~26 s cinematic prologue
              (plays once, then the theme fades in). Without it, the theme
              restarts at the top when the cinematic begins.

.mp3, .ogg, .m4a, .wav and .webm all work. Use royalty-free music or tracks
you have the rights to. No files here = the game is silent (apart from the
built-in sound effects).

Browsers block sound until someone interacts with the page. Either click the
TV page once (a small hint shows while sound is blocked), or start Chrome
for the TV like this so it plays by itself:

  chrome --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3100/tv

Press M on the TV page to mute / unmute.
