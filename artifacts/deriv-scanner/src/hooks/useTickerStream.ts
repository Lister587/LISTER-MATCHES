import { useEffect, useState, useRef, useCallback } from 'react';
import { extractDigit } from '../lib/digitAnalytics';

export const useTickerStream = (symbol: string) => {
  const [digits, setDigits] = useState<number[]>([]);
  const [quote, setQuote] = useState<number>(0);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setStatus('connecting');
    setDigits([]);
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/ticker?symbol=${symbol}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.tick) {
          const q = data.tick.quote;
          const digit = extractDigit(q);
          setQuote(q);
          setDigits(prev => {
            const next = [...prev, digit];
            if (next.length > 200) return next.slice(next.length - 200);
            return next;
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };
  }, [symbol]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { digits, quote, status };
};
