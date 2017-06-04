﻿import * as ts from "typescript";
import * as errors from "./../../errors";
import {insertCreatingSyntaxList, insertIntoSyntaxList, replaceStraight, getEndIndexFromArray, insertIntoBracesOrSourceFileWithFillAndGetChildren} from "./../../manipulation";
import {PropertyStructure, MethodStructure} from "./../../structures";
import {Node} from "./../common";
import {NamedNode, ExportableNode, ModifierableNode, AmbientableNode, DocumentationableNode, TypeParameteredNode, DecoratableNode, HeritageClauseableNode,
    ImplementsClauseableNode} from "./../base";
import {AbstractableNode} from "./base";
import {SourceFile} from "./../file";
import {ExpressionWithTypeArguments} from "./../type";
import {ConstructorDeclaration} from "./ConstructorDeclaration";
import {MethodDeclaration} from "./MethodDeclaration";
import {PropertyDeclaration} from "./PropertyDeclaration";
import {GetAccessorDeclaration} from "./GetAccessorDeclaration";
import {SetAccessorDeclaration} from "./SetAccessorDeclaration";

export type ClassPropertyTypes = PropertyDeclaration | GetAccessorDeclaration | SetAccessorDeclaration;
export type ClassMemberTypes = MethodDeclaration | PropertyDeclaration | GetAccessorDeclaration | SetAccessorDeclaration | ConstructorDeclaration;

export const ClassDeclarationBase = ImplementsClauseableNode(HeritageClauseableNode(DecoratableNode(TypeParameteredNode(
    DocumentationableNode(AmbientableNode(AbstractableNode(ExportableNode(ModifierableNode(NamedNode(Node))))))
))));
export class ClassDeclaration extends ClassDeclarationBase<ts.ClassDeclaration> {
    /**
     * Gets the extends expression.
     */
    getExtends(): ExpressionWithTypeArguments | undefined {
        const heritageClauses = this.getHeritageClauses();
        const extendsClause = heritageClauses.find(c => c.node.token === ts.SyntaxKind.ExtendsKeyword);
        if (extendsClause == null)
            return undefined;

        const types = extendsClause.getTypes();
        return types.length === 0 ? undefined : types[0];
    }

    /**
     * Sets the extends expression.
     * @param text - Text to set as the extends expression.
     * @param sourceFile - Optional source file to help with performance.
     */
    setExtends(text: string, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        errors.throwIfNotStringOrWhitespace(text, nameof(text));

        const heritageClauses = this.getHeritageClauses();
        const extendsClause = heritageClauses.find(c => c.node.token === ts.SyntaxKind.ExtendsKeyword);
        if (extendsClause != null) {
            const extendsClauseStart = extendsClause.getStart(sourceFile);
            replaceStraight(sourceFile, extendsClauseStart, extendsClause.getEnd() - extendsClauseStart, `extends ${text}`);
            return this;
        }

        const implementsClause = heritageClauses.find(c => c.node.token === ts.SyntaxKind.ImplementsKeyword);
        let insertPos: number;
        if (implementsClause != null) {
            insertPos = implementsClause.getStart();
        }
        else {
            const openBraceToken = this.getFirstChildByKindOrThrow(ts.SyntaxKind.OpenBraceToken, sourceFile);
            insertPos = openBraceToken.getStart();
        }

        const isLastSpace = /\s/.test(sourceFile.getFullText()[insertPos - 1]);
        let insertText = `extends ${text} `;
        if (!isLastSpace)
            insertText = " " + insertText;

        if (implementsClause == null)
            insertCreatingSyntaxList(sourceFile, insertPos, insertText);
        else
            insertIntoSyntaxList(sourceFile, insertPos, insertText, implementsClause.getParentSyntaxListOrThrow(), 0, 1);

        return this;
    }

    /**
     * Gets the constructor declaration or undefined if none exists.
     */
    getConstructor() {
        const constructorMember = this.node.members.find(m => m.kind === ts.SyntaxKind.Constructor) as ts.ConstructorDeclaration | undefined;
        return constructorMember == null ? undefined : this.factory.getConstructorDeclaration(constructorMember);
    }

    /**
     * Add property.
     * @param structure - Structure representing the property.
     * @param sourceFile - Optional source file to help improve performance.
     */
    addProperty(structure: PropertyStructure, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        return this.addProperties([structure], sourceFile)[0];
    }

    /**
     * Add properties.
     * @param structures - Structures representing the properties.
     * @param sourceFile - Optional source file to help improve performance.
     */
    addProperties(structures: PropertyStructure[], sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        return this.insertProperties(getEndIndexFromArray(this.node.members), structures, sourceFile);
    }

    /**
     * Insert property.
     * @param index - Index to insert at.
     * @param structure - Structure representing the property.
     * @param sourceFile - Optional source file to help improve performance.
     */
    insertProperty(index: number, structure: PropertyStructure, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        return this.insertProperties(index, [structure], sourceFile)[0];
    }

    /**
     * Insert properties.
     * @param index - Index to insert at.
     * @param structures - Structures representing the properties.
     * @param sourceFile - Optional source file to help improve performance.
     */
    insertProperties(index: number, structures: PropertyStructure[], sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        const indentationText = this.getChildIndentationText();

        // create code
        const codes: string[] = [];
        for (const structure of structures) {
            let code = `${indentationText}`;
            if (structure.isStatic)
                code += "static ";
            code += structure.name;
            if (structure.hasQuestionToken)
                code += "?";
            if (structure.type != null && structure.type.length > 0)
                code += `: ${structure.type}`;
            code += ";";
            codes.push(code);
        }

        return insertIntoBracesOrSourceFileWithFillAndGetChildren<PropertyDeclaration, PropertyStructure>({
            getChildren: () => this.getAllMembers(),
            sourceFile,
            parent: this,
            index,
            childCodes: codes,
            structures,
            previousBlanklineWhen: n => n.isBodyableNode() || n.isBodiedNode(),
            nextBlanklineWhen: n => n.isBodyableNode() || n.isBodiedNode(),
            expectedKind: ts.SyntaxKind.PropertyDeclaration
        });
    }

    /**
     * Gets the class instance property declarations.
     */
    getInstanceProperties(): ClassPropertyTypes[] {
        return this.getInstanceMembers()
            .filter(m => isClassPropertyType(m)) as ClassPropertyTypes[];
    }

    /**
     * Gets the class instance property declarations.
     */
    getStaticProperties(): ClassPropertyTypes[] {
        return this.getStaticMembers()
            .filter(m => isClassPropertyType(m)) as ClassPropertyTypes[];
    }

    /**
     * Add method.
     * @param structure - Structure representing the method.
     * @param sourceFile - Optional source file to help improve performance.
     */
    addMethod(structure: MethodStructure, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        return this.addMethods([structure], sourceFile)[0];
    }

    /**
     * Add methods.
     * @param structures - Structures representing the methods.
     * @param sourceFile - Optional source file to help improve performance.
     */
    addMethods(structures: MethodStructure[], sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        return this.insertMethods(getEndIndexFromArray(this.node.members), structures, sourceFile);
    }

    /**
     * Insert method.
     * @param index - Index to insert at.
     * @param structure - Structure representing the method.
     * @param sourceFile - Optional source file to help improve performance.
     */
    insertMethod(index: number, structure: MethodStructure, sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        return this.insertMethods(index, [structure], sourceFile)[0];
    }

    /**
     * Insert methods.
     * @param index - Index to insert at.
     * @param structures - Structures representing the methods.
     * @param sourceFile - Optional source file to help improve performance.
     */
    insertMethods(index: number, structures: MethodStructure[], sourceFile: SourceFile = this.getSourceFileOrThrow()) {
        const indentationText = this.getChildIndentationText();
        const newLineChar = this.factory.getLanguageService().getNewLine();

        // create code
        const codes: string[] = [];
        for (const structure of structures) {
            let code = indentationText;
            if (structure.isStatic)
                code += "static ";
            code += `${structure.name}()`;
            if (structure.returnType != null && structure.returnType.length > 0)
                code += `: ${structure.returnType}`;
            code += ` {` + newLineChar;
            code += indentationText + `}`;
            codes.push(code);
        }

        // insert, fill, and get created nodes
        return insertIntoBracesOrSourceFileWithFillAndGetChildren<MethodDeclaration, MethodStructure>({
            getChildren: () => this.getAllMembers(),
            sourceFile,
            parent: this,
            index,
            childCodes: codes,
            structures,
            previousBlanklineWhen: () => true,
            nextBlanklineWhen: () => true,
            separatorNewlineWhen: () => true,
            expectedKind: ts.SyntaxKind.MethodDeclaration
        });
    }

    /**
     * Gets the class instance method declarations.
     */
    getInstanceMethods(): MethodDeclaration[] {
        return this.getInstanceMembers().filter(m => m instanceof MethodDeclaration) as MethodDeclaration[];
    }

    /**
     * Gets the class instance method declarations.
     */
    getStaticMethods(): MethodDeclaration[] {
        return this.getStaticMembers().filter(m => m instanceof MethodDeclaration) as MethodDeclaration[];
    }

    /**
     * Gets the instance members.
     */
    getInstanceMembers() {
        return this.getAllMembers().filter(m => !m.isConstructorDeclaration() && !m.isStatic());
    }

    /**
     * Gets the static members.
     */
    getStaticMembers() {
        return this.getAllMembers().filter(m => !m.isConstructorDeclaration() && m.isStatic());
    }

    /**
     * Gets the instance and static members.
     */
    getAllMembers() {
        return this.node.members.map(m => this.factory.getNodeFromCompilerNode(m)) as ClassMemberTypes[];
    }
}

function isClassPropertyType(m: Node): m is ClassPropertyTypes {
    return m instanceof PropertyDeclaration || m instanceof SetAccessorDeclaration || m instanceof GetAccessorDeclaration;
}