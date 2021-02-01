/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject, postConstruct } from 'inversify';
import { EditorManager } from '@theia/editor/lib/browser';
import { ApplicationShell, CompositeTreeNode, Saveable, TreeModelImpl, Widget } from '@theia/core/lib/browser';

@injectable()
export class OpenEditorsModel extends TreeModelImpl {
    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(EditorManager) protected readonly editorManager: EditorManager;

    counter = 0;

    protected openWidgets: Widget[];


    @postConstruct()
    protected init(): void {
        super.init();
        this.toDispose.push(this.applicationShell.onDidAddWidget(widget => {
            if (Saveable.get(widget)) {
                // event fires before applicationShell.widgets is updated
                setTimeout(() => {
                    this.updateOpenWidgets();
                    this.root = this.buildRootFromOpenedWidgets(this.openWidgets);
                });
            }
        }));
        this.toDispose.push(this.applicationShell.onDidRemoveWidget(widget => {
            if (Saveable.get(widget)) {
                setTimeout(() => {
                    this.updateOpenWidgets();
                    this.root = this.buildRootFromOpenedWidgets(this.openWidgets);
                });
            }
        }));
        this.updateOpenWidgets();
        this.root = this.buildRootFromOpenedWidgets(this.openWidgets);
        this.fireChanged();
    }

    protected updateOpenWidgets(): void {
        this.openWidgets = this.applicationShell.widgets.filter(widget => Saveable.get(widget));
    }

    protected buildRootFromOpenedWidgets(widgets: Widget[]): CompositeTreeNode {
        const newRoot: CompositeTreeNode = {
            id: 'open-editors:root',
            parent: undefined,
            visible: false,
            children: []
        };
        this.openWidgets.forEach(widget => {
            const openEditorNode = {
                id: widget.id,
                parent: undefined,
                name: widget.title.label,
                icon: widget.title.iconClass,
                children: []
            }
            CompositeTreeNode.addChild(newRoot, openEditorNode);
        });
        return newRoot;
    }
}
