﻿import * as ts from "typescript";
import {Node} from "./../common";
import {SourceFile} from "./../file";
import {ModifierableNode} from "./ModifierableNode";

export type StaticableNodeExtensionType = Node & ModifierableNode;

export interface StaticableNode {
    /**
     * Gets if it's static.
     */
    isStatic(): boolean;
    /**
     * Gets the static keyword, or undefined if none exists.
     */
    getStaticKeyword(): Node | undefined;
    /**
     * Sets if the node is static.
     * @param value - If it should be static or not.
     * @param sourceFile - Optional source file to help improve performance.
     */
    setIsStatic(value: boolean, sourceFile?: SourceFile): this;
}

export function StaticableNode<T extends Constructor<StaticableNodeExtensionType>>(Base: T): Constructor<StaticableNode> & T {
    return class extends Base implements StaticableNode {
        isStatic() {
            return this.hasModifier(ts.SyntaxKind.StaticKeyword);
        }

        getStaticKeyword() {
            return this.getFirstModifierByKind(ts.SyntaxKind.StaticKeyword);
        }

        setIsStatic(value: boolean, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
            this.toggleModifier("static", value, sourceFile);
            return this;
        }
    };
}