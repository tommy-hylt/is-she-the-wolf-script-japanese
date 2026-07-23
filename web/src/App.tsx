import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type TextSegment = string | { kanji: string; reading: string };
type Cue = { id: string; time: string; timeEnd: string; character: string; segments: TextSegment[]; en: string; notes: string[] };
type PreparedCue = Omit<Cue, 'en'> & { english: string };
type Episode = { id: string; label: string; title: string; lessons: number; intro: string };
const episodes: Episode[] = [
  { id: '01', label: 'EPISODE 01', title: '大人のウソは、ワクワクする', lessons: 7, intro: 'The cast meets the idea of a more grown-up kind of love and deception.' },
  { id: '02', label: 'EPISODE 02', title: '好きな人にウソをつく', lessons: 6, intro: 'A first glance, a first crush, and the difficult rules of the wolf.' },
  { id: '03', label: 'EPISODE 03', title: 'のんびり編', lessons: 6, intro: 'A relaxed morning turns into a gentle lesson in natural conversation.' },
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

const speakerPhotos: Record<string, string> = {
  '桜子': 'Sakurako.jpg', 'ギャビー': 'Gyabii.jpg', 'じゅり': 'Juri.jpg', 'ほのか': 'Honoka.jpg', 'Mikako': 'Mikako.jpg', 'Ｍｉｋａｋｏ': 'Mikako.jpg',
  'トモキ': 'Tomoki.jpg', 'Who-ya': 'Who-ya.jpg', 'マサキ': 'Masaki.jpg', '大珠': 'Daiju.jpg', 'ロビン': 'Robin.jpg',
  '横澤': 'mc-yokosawa.jpg', '滝沢': 'mc-takizawa.jpg', 'ＲＩＫＵ': 'mc-riku.jpg', 'RIKU': 'mc-riku.jpg', '矢吹': 'mc-yabuki.jpg', '屋敷': 'mc-yashiki.jpg',
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
  const episode = episodes.find(item => item.id === episodeId) || episodes[0];
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
    if (loading || lesson.length === 0) return;

    const savedCueId = localStorage.getItem(readingLineKey(episode.id, lessonIndex));
    const restoreFrame = window.requestAnimationFrame(() => {
      if (savedCueId && lineRefs.current[savedCueId]) {
        lineRefs.current[savedCueId]?.scrollIntoView({ block: 'start' });
        window.scrollBy({ top: -24 });
      }
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

  const nextLesson = () => {
    const next = (lessonIndex + 1) % episode.lessons;
    setLessonIndex(next);
    localStorage.setItem(`wolf-position-${episode.id}`, String(next));
    writeRoute(episode.id, next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const previousLesson = () => {
    const previous = (lessonIndex - 1 + episode.lessons) % episode.lessons;
    setLessonIndex(previous);
    localStorage.setItem(`wolf-position-${episode.id}`, String(previous));
    writeRoute(episode.id, previous);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const selectEpisode = (id: string) => {
    const nextLesson = Number(localStorage.getItem(`wolf-position-${id}`) || 0);
    setEpisodeId(id);
    setLessonIndex(nextLesson);
    localStorage.setItem('wolf-episode', id);
    writeRoute(id, nextLesson);
  };

  let activeSpeaker = '';
  // The lesson renderer carries the last explicit speaker into continuation cues.
  // eslint-disable-next-line react-hooks/immutability
  return <div className="app"><header className="hero"><div className="eyebrow">Mikako Japanese · line-by-line study</div><h1>Is She the Wolf?</h1><p>Scripts for listening closely, feeling the nuance, and speaking a little more naturally.</p><div className="episode-tabs">{episodes.map(item => <button className={item.id === episode.id ? 'active' : ''} onClick={() => selectEpisode(item.id)} key={item.id}>{item.label}<small>{item.title}</small></button>)}</div></header><main><section className="intro"><div><span className="eyebrow">{episode.label}</span><h2>{episode.title}</h2><p>{episode.intro}</p></div></section>{loading ? <div className="state">Loading script…</div> : <><div className="lesson-bar"><span>Lesson {lessonIndex + 1}/{episode.lessons} · lines {lessonStart + 1}–{lessonStart + lesson.length}</span><div className="lesson-actions"><button onClick={previousLesson}>← Previous lesson</button><button onClick={nextLesson}>Next lesson →</button></div></div><section className="script">{lesson.map(cue => { if (cue.character.trim()) activeSpeaker = cue.character; const photoFile = getSpeakerPhoto(activeSpeaker); return <article className="cue" key={cue.id}>{photoFile && <img className="speaker-photo" src={`./speakers/${photoFile}`} alt="" aria-hidden="true" style={{ objectFit: 'cover', objectPosition: 'right center' }} />}<div className="cue-meta"><span>{cue.time}</span>{cue.character && <strong>{cue.character}</strong>}</div><div className="jp" data-cue-id={cue.id} ref={(element) => { lineRefs.current[cue.id] = element; }}>{renderSegments(cue.segments)}</div><div className="en">{cue.en}</div>{cue.notes.length > 0 && <blockquote className="teaching"><ul>{cue.notes.map(note => <li key={note}>{note}</li>)}</ul></blockquote>}</article>; })}</section></>}</main><footer>Built for patient, practical Japanese study · Episodes 1–3</footer></div>;
}
export default App;
