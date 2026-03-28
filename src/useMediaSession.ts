import { useEffect, useRef, useCallback } from 'react'

interface MediaSessionOptions {
  stepName: string
  stepEmoji: string
  projectName: string
  timeDisplay: string
  isRunning: boolean
  onPause: () => void
  onResume: () => void
  onComplete: () => void
}

export function useMediaSession({
  stepName,
  stepEmoji,
  projectName,
  timeDisplay,
  isRunning,
  onPause,
  onResume,
  onComplete,
}: MediaSessionOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isSupported = 'mediaSession' in navigator

  const initAudio = useCallback(() => {
    if (audioRef.current) return
    const silenceBase64 =
      'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'
    const audio = new Audio(`data:audio/mp3;base64,${silenceBase64}`)
    audio.loop = true
    audio.volume = 0.001
    audioRef.current = audio
  }, [])

  useEffect(() => {
    if (!isSupported) return
    if (isRunning) {
      initAudio()
      audioRef.current?.play().catch(() => {})
      navigator.mediaSession.playbackState = 'playing'
    } else {
      navigator.mediaSession.playbackState = 'paused'
    }
  }, [isRunning, isSupported, initAudio])

  useEffect(() => {
    if (!isSupported) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: stepName ? `${stepEmoji} ${stepName}` : '⏸ 일시정지',
      artist: timeDisplay,
      album: `🪑 ${projectName}`,
    })
  }, [stepName, stepEmoji, projectName, timeDisplay, isSupported])

  useEffect(() => {
    if (!isSupported) return

    navigator.mediaSession.setActionHandler('play', () => { onResume() })
    navigator.mediaSession.setActionHandler('pause', () => { onPause() })
    navigator.mediaSession.setActionHandler('nexttrack', () => { onComplete() })
    navigator.mediaSession.setActionHandler('previoustrack', () => { onPause() })

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
    }
  }, [isSupported, onPause, onResume, onComplete])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])
}