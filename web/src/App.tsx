import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type TextSegment = string | { kanji: string; reading: string };
type Cue = { id: string; time: string; timeEnd: string; character: string; segments: TextSegment[]; en: string; notes: string[] };
type PreparedCue = Omit<Cue, 'en'> & { english: string };
type Episode = { id: string; label: string; title: string; lessons: number; intro: string };
const episodes: Episode[] = [
  { id: '01', label: 'EPISODE 01', title: '大人のウソは、ワクワクする', lessons: 7, intro: 'The cast meets the idea of a more grown-up kind of love and deception.' },
  { id: '02', label: 'EPISODE 02', title: '好きな人にウソをつく', lessons: 6, intro: 'A first glance, a first crush, and the difficult rules of the wolf.' },
  { id: '03', label: 'EPISODE 03', title: 'のんびり編', lessons: 6, intro: 'A relaxed morning turns into a gentle lesson in natural conversation.' },
  { id: '05', label: 'EPISODE 05', title: '愛する人に嘘をついてもいいのか？', lessons: 7, intro: 'Feelings sharpen as the wolf game begins to affect real choices.' },
  { id: '06', label: 'EPISODE 06', title: '散りゆく桜に願いを込めて', lessons: 6, intro: 'Small conversations begin to carry larger romantic consequences.' },
  { id: '07', label: 'EPISODE 07', title: '手を取り合って交わした願い', lessons: 6, intro: 'The cast weighs trust, timing, and what remains unsaid.' },
  { id: '08', label: 'EPISODE 08', title: 'もう二度と会えないなら', lessons: 6, intro: 'After the mid-season confession, every reaction feels more exposed.' },
  { id: '09', label: 'EPISODE 09', title: 'あの笑顔を取り戻せない', lessons: 6, intro: 'Private conversations make the distance between honesty and strategy clearer.' },
  { id: '10', label: 'EPISODE 10', title: 'あなたの嘘を教えてください', lessons: 6, intro: 'With less time left, the cast speaks more directly about what they want.' },
  { id: '11', label: 'EPISODE 11', title: '最後の時、最後の嘘', lessons: 7, intro: 'The final stretch brings tenderness, doubt, and difficult choices together.' },
  { id: '12', label: 'EPISODE 12', title: '愛を使い果たさないで', lessons: 6, intro: 'The last confessions reveal what the cast could and could not say.' },
];
const curated: Record<string, Record<string, { en: string; notes: string[] }>> = {
  '01': {
    '3': { en: 'Netflix series: Is She the Wolf?', notes: ['には in the title marks the target or setting: “as for / in”.', '騙されない is a passive-looking form meaning “will not be deceived”.'] },
    '4': { en: 'It’s finally starting!', notes: ['ついに means “at last”, often carrying excitement or relief.', 'でーす stretches です for a bright, playful announcement.'] },
    '7': { en: 'Now, the latest Wolf series—so popular on ABEMA—', notes: ['さあ is a lively “well then / now”.', '最新作 means the newest installment: 最新 (latest) + 作 (work).'] },
    '8': { en: 'is going to be released worldwide on Netflix!', notes: ['ことになりました presents a decided arrangement as new information.', '世界配信 means distribution worldwide.'] },
    '15': { en: 'Once you become an adult, you start wondering what love is, right?', notes: ['やっぱこう is casual commentary: “as you’d expect, when it’s like this…”.', 'なんだろな softens “what is it, I wonder?” and sounds reflective.'] },
    '18': { en: 'Adult lies sound exciting.', notes: ['ワクワクする means to feel excited with anticipation.', 'その / やっぱ are conversational fillers that make the thought feel spontaneous.'] },
  },
  '02': {
    '3': { en: 'Yes, exactly. A wolf is a lonely role, isn’t it?', notes: ['って quotes or frames オオカミ as the role/concept being discussed.'] },
    '4': { en: 'It really is a lonely role, isn’t it?', notes: ['やっぱり means “as expected / when you think about it”.'] },
    '7': { en: 'I ended up having something like love at first sight.', notes: ['一目ぼれ is “love at first sight”.', '〜ちゃって (from 〜てしまって) suggests an unexpected result or helpless feeling.'] },
    '9': { en: 'I have to play the wolf.', notes: ['やらないといけない is a spoken obligation pattern: “must do”.', 'The subject is omitted; context tells us she means herself.'] },
    '11': { en: 'But lying to someone you like…', notes: ['でも sets up a contrast and leaves the feeling hanging.', '好きな人に uses に for the person affected by the action.'] },
    '12': { en: 'What am I supposed to do?', notes: ['どうしたらいい asks for the best course of action.', 'んだろ expresses uncertainty and quietly invites empathy.'] },
  },
  '03': {
    '3': { en: 'Oh!', notes: ['おっ is a short, casual exclamation of surprise or noticing someone.', 'It is much more relaxed than a full greeting.'] },
    '4': { en: 'Good morning! / Good morning.', notes: ['おはようございます is polite and warm, suitable for a professional setting.', 'The same greeting repeated can sound pleasantly synchronized.'] },
    '6': { en: 'Thank you for coming this early. / No, thank you.', notes: ['朝から means “from early this morning” and highlights the effort.', 'こちらこそ returns the thanks: “rather, I should thank you”.'] },
    '11': { en: 'I thought we could take it easy and go shopping.', notes: ['のんびり means leisurely, without rushing.', '〜っていうそれです is a casual way to clarify “that’s what I mean”.'] },
    '14': { en: 'Okay—so we can just keep it loose today, right?', notes: ['緩く means loosely / casually; repeating it makes the mood reassuring.', 'じゃあ moves from understanding to a practical conclusion.'] },
  },
};

function readRoute() {
  const params = new URLSearchParams(window.location.search);
  const requestedEpisode = params.get('episode');
  const episodeId = episodes.some(item => item.id === requestedEpisode)
    ? requestedEpisode!
    : localStorage.getItem('wolf-episode') || '01';
  const episode = episodes.find(item => item.id === episodeId) || episodes[0];
  const requestedPage = Number(params.get('page'));
  const storedPage = Number(localStorage.getItem(`wolf-position-${episode.id}`) || 0) + 1;
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : storedPage;
  return { episodeId: episode.id, lessonIndex: Math.min(Math.max(page - 1, 0), episode.lessons - 1) };
}

function writeRoute(episodeId: string, lessonIndex: number, replace = false) {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ episode: episodeId, page: String(lessonIndex + 1) }).toString();
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

function readingLineKey(episodeId: string, lessonIndex: number) {
  return `wolf-last-line:${episodeId}:${lessonIndex}`;
}

type LineReport = { cueId: string; episode: string; page: number; time: string; character: string; description: string; reportedAt: string };
const reportStorageKey = 'wolf-line-reports';

function readReports(): LineReport[] {
  try {
    const saved = JSON.parse(localStorage.getItem(reportStorageKey) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeReports(reports: LineReport[]) {
  localStorage.setItem(reportStorageKey, JSON.stringify(reports));
}

const speakerPhotos: Record<string, string> = {
  '桜子': 'Sakurako-redraw-v2.png', 'ギャビー': 'Gyabii-redraw-v2.png', 'じゅり': 'Juri-redraw-v2.png', 'ほのか': 'Honoka-redraw-v2.png', 'Mikako': 'Mikako-redraw-v2.png', 'Ｍｉｋａｋｏ': 'Mikako-redraw-v2.png',
  'トモキ': 'Tomoki-redraw-v2.png', 'Who-ya': 'Who-ya-redraw-v2.png', 'マサキ': 'Masaki-redraw-v2.png', '大珠': 'Daiju-redraw-v2.png', 'ロビン': 'Robin-redraw-v2.png',
  '横澤': 'mc-yokosawa-redraw-v2.png', '滝沢': 'mc-takizawa-redraw-v2.png', 'ＲＩＫＵ': 'mc-riku-redraw-v2.png', 'RIKU': 'mc-riku-redraw-v2.png', '矢吹': 'mc-yabuki-redraw-v2.png', '屋敷': 'mc-yashiki-redraw-v2.png',
};

function getSpeakerPhoto(character: string) {
  return character.replaceAll('/', '／').split(/\s*[／･]\s*/u).map(name => name.trim()).map(name => speakerPhotos[name]).find(Boolean);
}

function compactNotes(...args: unknown[]) {
  void args;
  return [];
}

function renderSegments(segments: TextSegment[]) {
  return segments.map((segment, index) => typeof segment === 'string'
    ? <span key={index}>{segment}</span>
    : <ruby key={index}>{segment.kanji}<rt>{segment.reading}</rt></ruby>);
}

function App() {
  const [route] = useState(readRoute);
  const [episodeId, setEpisodeId] = useState(route.episodeId);
  const [cues, setCues] = useState<Cue[]>([]);
  const [loadedEpisode, setLoadedEpisode] = useState('');
  const [lessonIndex, setLessonIndex] = useState(route.lessonIndex);
  const lineRefs = useRef<Record<string, HTMLElement | null>>({});
  const smoothNavigationRef = useRef(false);
  const navigationTargetRef = useRef<'top' | 'intro' | 'lesson'>('top');
  const navigationRequestRef = useRef(0);
  const episode = episodes.find(item => item.id === episodeId) || episodes[0];
  const episodeIndex = episodes.findIndex(item => item.id === episode.id);
  const loading = loadedEpisode !== episode.id;
  const lessonSize = Math.max(1, Math.ceil(cues.length / episode.lessons));
  const lessonStart = lessonIndex * lessonSize;
  const lesson = useMemo(() => cues.slice(lessonStart, Math.min(lessonStart + lessonSize, cues.length)), [cues, lessonStart, lessonSize]);

  useEffect(() => {
    writeRoute(route.episodeId, route.lessonIndex, true);
  }, [route.episodeId, route.lessonIndex]);

  useEffect(() => {
    fetch(`./data/episode-${episode.id}.json`)
      .then(response => response.json() as Promise<PreparedCue[]>)
      .then(data => {
        setCues(data.map(cue => {
          const override = curated[episode.id]?.[String(Number(cue.id.slice(-4)))];
          return { ...cue, en: override?.en || cue.english || '', notes: compactNotes(override?.notes || cue.notes) };
        }));
        setLoadedEpisode(episode.id);
      });
    localStorage.setItem('wolf-episode', episode.id);
  }, [episode]);

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = readRoute();
      setEpisodeId(nextRoute.episodeId);
      setLessonIndex(nextRoute.lessonIndex);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const script = document.querySelector('.script');
    if (!script) return;
    const handleClick = (event: Event) => {
      if ((event.target as HTMLElement).closest('.line-report, .line-report-form')) return;
      const cue = (event.target as HTMLElement).closest('.cue');
      if (cue && script.contains(cue)) cue.classList.toggle('photo-visible');
    };
    script.addEventListener('click', handleClick);
    return () => script.removeEventListener('click', handleClick);
  }, [lesson, loading]);

  useEffect(() => {
    if (loading || lesson.length === 0) return;

    const savedCueId = localStorage.getItem(readingLineKey(episode.id, lessonIndex));
    const navigationRequest = navigationRequestRef.current;
    const restoreFrame = window.requestAnimationFrame(() => {
      if (navigationRequest !== navigationRequestRef.current) return;
      const behavior = smoothNavigationRef.current ? 'smooth' : 'auto';
      if (smoothNavigationRef.current && navigationTargetRef.current === 'intro') {
        document.querySelector('.intro')?.scrollIntoView({ block: 'start', behavior });
      } else if (smoothNavigationRef.current && navigationTargetRef.current === 'lesson') {
        document.querySelector('.lesson-bar')?.scrollIntoView({ block: 'start', behavior });
      } else if (savedCueId && lineRefs.current[savedCueId]) {
        lineRefs.current[savedCueId]?.scrollIntoView({ block: 'start', behavior });
        window.scrollBy({ top: -24, behavior });
      } else if (smoothNavigationRef.current) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      smoothNavigationRef.current = false;
    });
    let trackingEnabled = !savedCueId;
    const trackingTimer = window.setTimeout(() => {
      trackingEnabled = true;
    }, savedCueId ? 1000 : 0);

    const observer = new IntersectionObserver((entries) => {
      if (!trackingEnabled || !entries.some(entry => entry.isIntersecting)) return;
      const completeLines = lesson
        .map(cue => lineRefs.current[cue.id])
        .filter((element): element is HTMLElement => Boolean(element))
        .map(element => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.top >= 24 && rect.bottom <= window.innerHeight - 16)
        .sort((a, b) => a.rect.top - b.rect.top);
      const firstComplete = completeLines[0];
      const cueId = firstComplete?.element.getAttribute('data-cue-id');
      if (cueId) {
        localStorage.setItem(readingLineKey(episode.id, lessonIndex), cueId);
      }
    }, { threshold: 0.55 });

    lesson.forEach(cue => {
      const element = lineRefs.current[cue.id];
      if (element) observer.observe(element);
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.clearTimeout(trackingTimer);
      observer.disconnect();
    };
  }, [episode.id, lesson, lessonIndex, loading]);

  const nextLesson = useCallback(() => {
    navigationRequestRef.current += 1;
    smoothNavigationRef.current = true;
    if (lessonIndex === episode.lessons - 1 && episodeIndex < episodes.length - 1) {
      const nextEpisode = episodes[episodeIndex + 1];
      navigationTargetRef.current = 'intro';
      setEpisodeId(nextEpisode.id);
      setLessonIndex(0);
      localStorage.setItem('wolf-episode', nextEpisode.id);
      localStorage.setItem(`wolf-position-${nextEpisode.id}`, '0');
      writeRoute(nextEpisode.id, 0);
      return;
    }
    const next = lessonIndex + 1;
    navigationTargetRef.current = 'lesson';
    setLessonIndex(next);
    localStorage.setItem(`wolf-position-${episode.id}`, String(next));
    writeRoute(episode.id, next);
  }, [episode.id, episode.lessons, episodeIndex, lessonIndex]);
  const previousLesson = useCallback(() => {
    const previous = (lessonIndex - 1 + episode.lessons) % episode.lessons;
    navigationRequestRef.current += 1;
    smoothNavigationRef.current = true;
    navigationTargetRef.current = 'lesson';
    setLessonIndex(previous);
    localStorage.setItem(`wolf-position-${episode.id}`, String(previous));
    writeRoute(episode.id, previous);
  }, [episode.id, episode.lessons, lessonIndex]);
  const selectEpisode = (id: string) => {
    const nextLesson = Number(localStorage.getItem(`wolf-position-${id}`) || 0);
    navigationRequestRef.current += 1;
    smoothNavigationRef.current = true;
    navigationTargetRef.current = 'intro';
    if (id === episode.id) {
      window.requestAnimationFrame(() => {
        document.querySelector('.intro')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      smoothNavigationRef.current = false;
      return;
    }
    setEpisodeId(id);
    setLessonIndex(nextLesson);
    localStorage.setItem('wolf-episode', id);
    writeRoute(id, nextLesson);
  };

  useEffect(() => {
    if (loading) return;
    const topActions = document.querySelector('.lesson-bar .lesson-actions');
    const topButtons = topActions?.querySelectorAll('button');
    if (!topButtons || topButtons.length < 2) return;
    const previousTop = topButtons[0] as HTMLButtonElement;
    const nextTop = topButtons[1] as HTMLButtonElement;
    const canAdvance = lessonIndex < episode.lessons - 1 || episodeIndex < episodes.length - 1;
    previousTop.textContent = 'Previous';
    nextTop.textContent = 'Next';
    previousTop.hidden = lessonIndex === 0;
    nextTop.hidden = !canAdvance;

    const bottomActions = document.createElement('div');
    bottomActions.className = 'lesson-actions lesson-actions-bottom';
    if (lessonIndex > 0) {
      const previous = document.createElement('button');
      previous.type = 'button';
      previous.textContent = 'Previous';
      previous.addEventListener('click', previousLesson);
      bottomActions.append(previous);
    }
    if (canAdvance) {
      const next = document.createElement('button');
      next.type = 'button';
      next.textContent = 'Next';
      next.addEventListener('click', nextLesson);
      bottomActions.append(next);
    }
    document.querySelector('.script')?.insertAdjacentElement('afterend', bottomActions);
    return () => {
      bottomActions.remove();
    };
  }, [episode.lessons, episodeIndex, lessonIndex, loading, nextLesson, previousLesson]);

  useEffect(() => {
    if (loading) return;
    const script = document.querySelector('.script');
    if (!script) return;
    const articles = [...script.querySelectorAll<HTMLElement>('.cue')];
    const injected: HTMLElement[] = [];
    const currentReports = readReports();

    lesson.forEach((cue, index) => {
      const article = articles[index];
      if (!article) return;
      const existing = currentReports.find(report => report.cueId === cue.id);
      const reportButton = document.createElement('button');
      reportButton.type = 'button';
      reportButton.className = 'line-report';
      reportButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18m0-17h12l-3 4 3 4H5" /></svg>';
      reportButton.title = existing ? 'Reported line' : 'Report a problem with this line';
      reportButton.setAttribute('aria-label', `Report problem on ${cue.time}`);

      const reportForm = document.createElement('div');
      reportForm.className = 'line-report-form';
      reportForm.hidden = true;
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'What looks wrong?';
      input.value = existing?.description || '';
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.textContent = 'Save';
      reportForm.append(input, saveButton);

      const ensureReport = () => {
        const reports = readReports();
        if (!reports.some(report => report.cueId === cue.id)) {
          reports.push({ cueId: cue.id, episode: episode.id, page: lessonIndex + 1, time: cue.time, character: cue.character, description: '', reportedAt: new Date().toISOString() });
          writeReports(reports);
        }
        reportButton.title = 'Reported line';
        reportForm.hidden = false;
        input.focus();
      };
      reportButton.addEventListener('click', event => {
        event.stopPropagation();
        ensureReport();
        exportButton.textContent = `Export ${readReports().length} reports`;
      });
      saveButton.addEventListener('click', event => {
        event.stopPropagation();
        const reports = readReports();
        const report = reports.find(item => item.cueId === cue.id);
        if (report) report.description = input.value.trim();
        writeReports(reports);
        reportForm.hidden = true;
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') saveButton.click();
      });
      article.append(reportButton, reportForm);
      injected.push(reportButton, reportForm);
    });

    const reportTools = document.createElement('div');
    reportTools.className = 'report-tools';
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'report-tool';
    exportButton.textContent = `Export ${currentReports.length} reports`;
    exportButton.addEventListener('click', async () => {
      const text = JSON.stringify(readReports(), null, 2);
      try {
        await navigator.clipboard.writeText(text);
        exportButton.textContent = 'Reports copied';
      } catch {
        const fallback = document.createElement('textarea');
        fallback.value = text;
        document.body.append(fallback);
        fallback.select();
        document.execCommand('copy');
        fallback.remove();
        exportButton.textContent = 'Reports copied';
      }
    });
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'report-tool';
    clearButton.textContent = 'Clear reports';
    clearButton.addEventListener('click', () => {
      localStorage.removeItem(reportStorageKey);
      exportButton.textContent = 'Export 0 reports';
      clearButton.textContent = 'Reports cleared';
    });
    reportTools.append(exportButton, clearButton);
    document.querySelector('footer')?.prepend(reportTools);
    injected.push(reportTools);
    return () => injected.forEach(element => element.remove());
  }, [episode.id, lesson, lessonIndex, loading]);

  let activeSpeaker = '';
  // The lesson renderer carries the last explicit speaker into continuation cues.
  // eslint-disable-next-line react-hooks/immutability
  return <div className="app"><header className="hero"><div className="eyebrow">Mikako Japanese · line-by-line study</div><h1>Is She the Wolf?</h1><p>Scripts for listening closely, feeling the nuance, and speaking a little more naturally.</p><div className="episode-tabs">{episodes.map(item => <button className={item.id === episode.id ? 'active' : ''} onClick={() => selectEpisode(item.id)} key={item.id}>{item.label}<small>{item.title}</small></button>)}</div></header><main><section className="intro"><div><span className="eyebrow">{episode.label}</span><h2>{episode.title}</h2><p>{episode.intro}</p></div></section>{loading ? <div className="state">Loading script…</div> : <><div className="lesson-bar"><span>Lesson {lessonIndex + 1}/{episode.lessons} · lines {lessonStart + 1}–{lessonStart + lesson.length}</span><div className="lesson-actions"><button onClick={previousLesson}>← Previous lesson</button><button onClick={nextLesson}>Next lesson →</button></div></div><section className="script">{lesson.map(cue => { if (cue.character.trim()) activeSpeaker = cue.character; const photoFile = getSpeakerPhoto(activeSpeaker); return <article className="cue" key={cue.id}>{photoFile && <img className="speaker-photo" src={`./speakers/${photoFile}`} alt="" aria-hidden="true" style={{ objectFit: 'cover', objectPosition: 'right center' }} />}<div className="cue-meta"><span>{cue.time}</span>{cue.character && <strong>{cue.character}</strong>}</div><div className="jp" data-cue-id={cue.id} ref={(element) => { lineRefs.current[cue.id] = element; }}>{renderSegments(cue.segments)}</div><div className="en">{cue.en}</div>{cue.notes.length > 0 && <blockquote className="teaching"><ul>{cue.notes.map(note => <li key={note}>{note}</li>)}</ul></blockquote>}</article>; })}</section></>}</main><footer>Built for patient, practical Japanese study · Episodes 1–3, 5–12</footer></div>;
}
export default App;
