"use client";

import React, { useEffect, useState, useCallback } from "react";

const lettersAndSymbols = "abcdefghijklmnopqrstuvwxyz!@#$%^&*-_+=;:<>,";

interface AnimatedTextProps {
  text: string;
}

export function AnimatedText({ text }: AnimatedTextProps) {
  const [animatedText, setAnimatedText] = useState("");

  const getRandomChar = useCallback(
    () =>
      lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)],
    [],
  );

  const animateText = useCallback(async () => {
    const duration = 50;
    const revealDuration = 80;
    const initialRandomDuration = 300;

    const generateRandomText = () =>
      text
        .split("")
        .map(() => getRandomChar())
        .join("");

    setAnimatedText(generateRandomText());

    const runInitialScramble = async (endTime: number): Promise<void> => {
      if (Date.now() >= endTime) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, duration));
      setAnimatedText(generateRandomText());

      await runInitialScramble(endTime);
    };

    const revealCharacter = async (index: number): Promise<void> => {
      if (index >= text.length) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, revealDuration));
      setAnimatedText(
        (prevText) =>
          text.slice(0, index + 1) +
          prevText
            .slice(index + 1)
            .split("")
            .map(() => getRandomChar())
            .join(""),
      );

      await revealCharacter(index + 1);
    };

    await runInitialScramble(Date.now() + initialRandomDuration);
    await revealCharacter(0);
  }, [text, getRandomChar]);

  useEffect(() => {
    animateText();
  }, [text, animateText]);

  return <div className="relative inline-block">{animatedText}</div>;
}
