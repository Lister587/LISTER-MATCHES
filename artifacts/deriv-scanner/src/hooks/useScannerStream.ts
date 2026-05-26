import { useEffect, useState, useRef, useCallback } from 'react';
import { ALL_SYMBOLS, extractDigit } from '../lib/digitAnalytics';

export const useScannerStream = () => {
  const [data, setData] = useState<Record<string, number[]>>({});
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const buffersRef = useRef<Record<string, number[]>>({});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setStatus('connecting');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/scanner`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'tick' && msg.symbol) {
          const digit = extractDigit(msg.quote);
          const sym = msg.symbol;
          
          if (!buffersRef.current[sym]) {
            buffersRef.current[sym] = [];
          }
          
          buffersRef.current[sym].push(digit);
          if (buffersRef.current[sym].length > 100) {
            buffersRef.current[sym].shift();
          }
          
          setData({ ...buffersRef.current });
        }
      } catch (e) {
        console.error(e);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };
  }, []);

  useEffect(() => {
    ALL_SYMBOLS.forEach(sym => {
      buffersRef.current[sym] = [];
    });
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { data, status };
};
