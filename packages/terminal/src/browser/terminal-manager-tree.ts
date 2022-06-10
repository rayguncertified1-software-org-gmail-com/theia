// *****************************************************************************
// Copyright (C) 2022 YourCompany and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

// import { injectable } from '@theia/core/shared/inversify';
// import { TreeImpl, CompositeTreeNode, SelectableTreeNode } from '@theia/core/lib/browser';
// import { TerminalWidget } from './base/terminal-widget';

// export namespace TerminalManagerTreeTypes {
//     export interface TerminalNode extends SelectableTreeNode, CompositeTreeNode {
//         terminal: true;
//         widget: TerminalWidget;
//     };
//     export interface PageNode extends SelectableTreeNode, CompositeTreeNode {
//         page: true;
//         children: TerminalNode[];
//     }
//     export const isPageNode = (obj: unknown): obj is PageNode => !!obj && typeof obj === 'object' && 'page' in obj;
//     export const isTerminalNode = (obj: unknown): obj is TerminalNode => !!obj && typeof obj === 'object' && 'terminal' in obj;
//     export interface SelectionChangedEvent {
//         activePage: PageNode;
//         activeTerminal: TerminalNode;
//     }
// }
// @injectable()
// export class TerminalManagerTree extends TreeImpl {
//     // protected pages: Set<TerminalManagerTreeTypes.PageNode> = new Set();
//     // protected activePage: TerminalManagerTreeTypes.PageNode;
//     // protected activeTerminal: TerminalManagerTreeTypes.TerminalNode;
//     // protected pageNum = 0;

//     // protected  = new Emitter<TerminalManagerTreeTypes.SelectionChangedEvent>();
//     // readonly onTreeSeleonTreeSelectionChangedEmitterctionChanged = this.onTreeSelectionChangedEmitter.event;

//     // @postConstruct()
//     // protected init(): void {
//     //     this.root = { id: 'root', parent: undefined, children: [], visible: false } as CompositeTreeNode;
//     //     this.toDispose.push(this.onTreeSelectionChangedEmitter);
//     // }

//     // addWidget(widget: TerminalWidget, _activePage: TerminalManagerTreeTypes.PageNode): void {
//     //     const widgetNode = this.createWidgetNode(widget);
//     //     if (this.root && CompositeTreeNode.is(this.root)) {
//     //         CompositeTreeNode.addChild(this.activePage, widgetNode);
//     //         this.refresh();
//     //     }
//     // }

//     // handleSelectionChanged(selectedNode: SelectableTreeNode): void {
//     //     if (TerminalManagerTreeTypes.isPageNode(selectedNode)) {
//     //         this.activePage = selectedNode;
//     //     } else if (TerminalManagerTreeTypes.isTerminalNode(selectedNode)) {
//     //         const activePage = selectedNode.parent;
//     //         if (TerminalManagerTreeTypes.isPageNode(activePage) && TerminalManagerTreeTypes.isTerminalNode(selectedNode)) {
//     //             this.activePage = activePage;
//     //             this.activeTerminal = selectedNode;
//     //         }
//     //     }
//     //     this.onTreeSelectionChangedEmitter.fire({ activePage: this.activePage, activeTerminal: this.activeTerminal });
//     // }

//     // protected createPageNode(): TerminalManagerTreeTypes.PageNode {
//     //     return {
//     //         id: `page ${this.pageNum++}`,
//     //         parent: undefined,
//     //         selected: false,
//     //         children: [],
//     //         page: true,
//     //     };
//     // }

//     // protected createWidgetNode(widget: TerminalWidget): TerminalManagerTreeTypes.TerminalNode {
//     //     return {
//     //         id: `${widget.id}`,
//     //         parent: undefined,
//     //         children: [],
//     //         widget,
//     //         selected: false,
//     //         terminal: true,
//     //     };
//     // }

//     // addPage(): void {
//     //     const pageNode = this.createPageNode();
//     //     if (this.root && CompositeTreeNode.is(this.root)) {
//     //         this.root = CompositeTreeNode.addChild(this.root, pageNode);
//     //         this.activePage = pageNode;
//     //     }
//     // }
// }
