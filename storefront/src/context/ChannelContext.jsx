import { createContext, useContext, useState, useEffect } from "react";

const ChannelContext = createContext(null);

export function ChannelProvider({ children }) {
  const [channel, setChannelState] = useState(() => localStorage.getItem("pillpoints_channel"));

  function setChannel(value) {
    if (value) localStorage.setItem("pillpoints_channel", value);
    else localStorage.removeItem("pillpoints_channel");
    setChannelState(value);
  }

  return <ChannelContext.Provider value={{ channel, setChannel }}>{children}</ChannelContext.Provider>;
}

export function useChannel() {
  return useContext(ChannelContext);
}
