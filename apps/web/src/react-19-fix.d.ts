// React 19 compatibility fix
// This addresses type incompatibilities between React 19 and libraries
// that haven't updated their types yet

import type { ReactNode, ReactElement } from "react";

// Patch React types to accept Promise<ReactNode> as a valid return type
declare module "react" {
  namespace React {
    // Make ReactNode include Promise<ReactNode> and bigint for compatibility
    // This ensures compatibility across different @types/react versions
    // Note: JSX.Element is React.ReactElement, which is already included in ReactNode
    type ReactNode =
      | ReactElement
      | string
      | number
      | bigint
      | boolean
      | null
      | undefined
      | Iterable<ReactNode>
      | ReactPortal
      | Promise<ReactNode>;
  }

  // Override FunctionComponent to accept Promise<ReactNode>
  // JSX.Element is compatible since it's React.ReactElement which is part of ReactNode
  interface FunctionComponent<P = {}> {
    (props: P, context?: any): ReactElement<any> | JSX.Element | null | Promise<ReactNode>;
  }
  
  // Override ForwardRefExoticComponent
  interface ForwardRefExoticComponent<T> {
    (props: T & { ref?: React.Ref<any> }): ReactElement<any> | JSX.Element | null | Promise<ReactNode>;
  }
  
  // Override MemoExoticComponent
  interface MemoExoticComponent<T> {
    (props: T & { ref?: React.Ref<any> }): ReactElement<any> | JSX.Element | null | Promise<ReactNode>;
  }
}

// Make JSX namespace more permissive for React 19
// This is the key fix - making JSX accept Promise<ReactNode> as a valid component return type
declare global {
  namespace JSX {
    // Override ElementChildrenAttribute to allow Promise<ReactNode>
    interface ElementChildrenAttribute {
      children: ReactNode | Promise<ReactNode>;
    }
    
    // Ensure Element (JSX.Element) is compatible with ReactNode
    // This makes JSX.Element assignable to React.ReactNode for Next.js compatibility
    interface Element extends React.ReactElement<any, any> {}
    
    // Override ElementConstructor to accept Promise<ReactNode> and bigint
    // This is the critical fix - making JSX accept components that return Promise<ReactNode>
    type ElementConstructor =
      | ((
          props: any,
          deprecatedLegacyContext?: any,
        ) => 
          | React.ReactElement<any, any>
          | null
          | Promise<React.ReactNode>
          | React.ReactNode
          | bigint)
      | (new (props: any) => React.Component<any, any>);
    
    // Make ElementType accept components that return Promise<ReactNode>
    type ElementType<P = any> =
      | {
          [K in keyof JSX.IntrinsicElements]: P extends JSX.IntrinsicElements[K]
            ? K
            : never;
        }[keyof JSX.IntrinsicElements]
      | React.ComponentType<P>
      | ((props: P) => ReactNode | Promise<ReactNode>);
  }
  
  // Ensure ReactNode includes bigint and Promise<ReactNode> at the global level
  // JSX.Element is React.ReactElement, which is already included in ReactNode
  namespace React {
    type ReactNode =
      | ReactElement
      | string
      | number
      | bigint
      | boolean
      | null
      | undefined
      | Iterable<ReactNode>
      | ReactPortal
      | Promise<ReactNode>;
  }
}

// Patch react/jsx-runtime to accept Promise<ReactNode>
declare module "react/jsx-runtime" {
  export namespace JSX {
    interface Element extends ReactElement<any, any> {}
    interface ElementClass {
      render(): ReactNode | Promise<ReactNode>;
    }
    type ElementType<P = any> =
      | {
          [K in keyof JSX.IntrinsicElements]: P extends JSX.IntrinsicElements[K]
            ? K
            : never;
        }[keyof JSX.IntrinsicElements]
      | React.ComponentType<P>
      | ((props: P) => ReactNode | Promise<ReactNode>);
  }
}

// Type compatibility helper: ensure JSX.Element is assignable to ReactNode
// This is needed because Next.js checks function return types strictly
type CompatibleReactNode = React.ReactNode | JSX.Element;

// Patch Next.js internal types to accept JSX.Element as compatible with ReactNode
// This fixes the type error where Next.js expects ReactNode but TypeScript infers JSX.Element
declare module "next/dist/server/app-render/types" {
  export type AppPageConfig<
    Route extends string,
    T extends Record<string, any> = {},
  > = {
    [K in keyof T]: K extends "default"
      ? T[K] extends () => CompatibleReactNode | Promise<CompatibleReactNode>
        ? T[K]
        : T[K] extends () => JSX.Element
          ? T[K]
          : T[K] extends () => any
            ? T[K]
            : never
      : T[K];
  };
}

// Also patch the Next.js page type checking at a higher level
declare module "next" {
  export type AppPageConfig<
    Route extends string,
    T extends Record<string, any> = {},
  > = {
    [K in keyof T]: K extends "default"
      ? T[K] extends () => CompatibleReactNode | Promise<CompatibleReactNode>
        ? T[K]
        : T[K] extends () => JSX.Element
          ? T[K]
          : T[K] extends () => any
            ? T[K]
            : never
      : T[K];
  };
}

// Patch external libraries that haven't updated their types
declare module "convex/react" {
  export interface ConvexProviderProps {
    client: any;
    children?: ReactNode | Promise<ReactNode>;
  }
}
