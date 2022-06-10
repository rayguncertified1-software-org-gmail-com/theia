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

import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { TreeImpl, CompositeTreeNode, SelectableTreeNode } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';

export interface TerminalManagerTreeNode extends SelectableTreeNode {
    widget: TerminalWidget;
};
@injectable()
export class TerminalManagerTree extends TreeImpl {
    @postConstruct()
    protected init(): void {
        this.root = { id: 'root', parent: undefined, children: [], visible: false } as CompositeTreeNode;
    }

    addWidget(widget: TerminalWidget): void {
        const widgetNode: TerminalManagerTreeNode = {
            id: widget.id,
            parent: undefined,
            widget,
            selected: false,
        };
        if (this.root && CompositeTreeNode.is(this.root)) {
            this.root = CompositeTreeNode.addChild(this.root, widgetNode);
        }
    }
}
