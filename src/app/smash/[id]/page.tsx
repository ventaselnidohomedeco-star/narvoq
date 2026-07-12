'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';

const Avatar = ({ url, name, size = 'w-9 h-9' }: any) => url
  ? <img src={url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  : <span className={`${size} rounded-full bg-grafito text-ball font-display font-black flex items-center justify-center shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

// Cuenta el tiempo que queda hasta que un mensaje expire (24hs desde creado).
function ttl(expires_at: string) {
  const s = (new Date(expires_at).getTime() - Date.now()) / 1000;
  if (s <= 0) return 'expirado';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SmashChat() {
  const { id: chatId } = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [other, setOther] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let sub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setMe(p);

      const { data: chat } = await supabase.from('chats')
        .select(`id, user_a, user_b,
          a:profiles!user_a(id, username, first_name, last_name, avatar_url),
          b:profiles!user_b(id, username, first_name, last_name, avatar_url)`)
        .eq('id', chatId).single();
      if (!chat) return router.push('/smash');
      setOther(chat.user_a === user.id ? chat.b : chat.a);

      const { data: msgs } = await supabase.from('messages')
        .select('*').eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      setMessages(msgs ?? []);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 100);

      // Realtime: nuevos mensajes en este chat
      sub = supabase.channel(`chat:${chatId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `chat_id=eq.${chatId}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
        })
        .subscribe();
    })();
    return () => { if (sub) supabase.removeChannel(sub); };
  }, [chatId]);

  async function enviar() {
    if (!text.trim() || !me) return;
    const t = text.trim();
    setText('');
    const { error: err } = await supabase.from('messages').insert({
      chat_id: chatId, sender_id: me.id, text_content: t
    });
    if (err) return setError(err.message);
    await supabase.from('chats').update({ last_message_at: new Date().toISOString() })
      .eq('id', chatId);
  }

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    setUploading(true); setError('');
    const url = await uploadImage(file, 'smash');
    setUploading(false);
    if (!url) return setError('No pudimos subir la foto.');
    const { error: err } = await supabase.from('messages').insert({
      chat_id: chatId, sender_id: me.id, image_url: url
    });
    if (err) return setError(err.message);
    await supabase.from('chats').update({ last_message_at: new Date().toISOString() })
      .eq('id', chatId);
  }

  return (
    <main className="min-h-dvh max-w-md mx-auto flex flex-col">
      <header className="sticky top-0 bg-[#0B0F16]/95 backdrop-blur border-b border-white/10 px-3 py-3 flex items-center gap-3 z-40">
        <Link href="/smash" className="text-white/60 text-lg px-1">←</Link>
        <Avatar url={other?.avatar_url} name={other?.first_name} />
        <div className="flex-1 min-w-0">
          <p className="font-display font-black text-sm truncate">{other?.first_name} {other?.last_name}</p>
          <p className="text-white/40 text-[10px]">@{other?.username} · mensajes efímeros 24h</p>
        </div>
        <span className="text-ball text-[10px] font-black">🔒 24H</span>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl">💬</p>
            <p className="text-white/50 mt-2 text-sm">Sin mensajes todavía. Mandale un saludo 🎾</p>
          </div>
        )}
        {messages.map(m => {
          const mine = m.sender_id === me?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl p-2.5 ${mine ? 'bg-ball text-courtdark rounded-br-sm' : 'bg-grafito text-white rounded-bl-sm'}`}>
                {m.image_url && <img src={m.image_url} alt="" className="rounded-lg mb-2 max-h-64 object-cover" />}
                {m.text_content && <p className="text-sm whitespace-pre-wrap break-words">{m.text_content}</p>}
                <p className={`text-[9px] mt-1 ${mine ? 'text-courtdark/60' : 'text-white/40'} text-right`}>
                  ⏳ {ttl(m.expires_at)}
                </p>
              </div>
            </div>
          );
        })}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>

      <div className="sticky bottom-0 bg-[#0B0F16] border-t border-white/10 p-3 flex items-center gap-2">
        <label className="w-11 h-11 shrink-0 rounded-full bg-white/10 flex items-center justify-center cursor-pointer active:scale-95 transition">
          {uploading ? '…' : '📷'}
          <input type="file" accept="image/*" className="hidden" onChange={enviarFoto} />
        </label>
        <input className="input flex-1 !py-3" placeholder="Escribí un mensaje…" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && enviar()} />
        <button onClick={enviar} disabled={!text.trim()}
          className="w-11 h-11 shrink-0 rounded-full bg-ball text-courtdark font-black flex items-center justify-center disabled:opacity-40 active:scale-95">
          ➤
        </button>
      </div>
    </main>
  );
}
