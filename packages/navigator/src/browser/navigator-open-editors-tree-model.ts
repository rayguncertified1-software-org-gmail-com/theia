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
import { FileStatNode, FileTreeModel } from '@theia/filesystem/lib/browser';
import { ApplicationShell, CompositeTreeNode, Navigatable, Widget } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';

@injectable()
export class OpenEditorsModel extends FileTreeModel {
    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(EditorManager) protected readonly editorManager: EditorManager;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    counter = 0;

    protected openWidgets: Widget[];

    @postConstruct()
    protected init(): void {
        super.init();
        this.initializeRoot();
    }

    protected async initializeRoot(): Promise<void> {
        // this.toDispose.push(this.applicationShell.onDidAddWidget(widget => {
        //     if (Saveable.get(widget)) {
        //         // event fires before applicationShell.widgets is updated
        //         setTimeout(async () => {
        //             this.updateOpenWidgets();
        //             this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
        //             console.log('SENTINEL FILTERED WIDGETS', this.openWidgets);
        //         });
        //     }
        // }));
        this.toDispose.push(this.workspaceService.onWorkspaceChanged(workspaceChangedEvent => {
            console.log('SENTINEL WORKSPACE CHANGED', workspaceChangedEvent);
        }));
        this.toDispose.push(this.workspaceService.onWorkspaceLocationChanged(event => {
            console.log('SENTINEL LOCATION CHANGED', event);
        }))
        this.toDispose.push(this.applicationShell.onDidChangeCurrentWidget(async () => {
            setTimeout(async () => {
                this.updateOpenWidgets();
                this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
                console.log('SENTINEL CHANGED CURRENT', this.openWidgets);
            });
        }));
        this.toDispose.push(this.editorManager.onActiveEditorChanged(async _widget => {
            this.updateOpenWidgets();
            this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
        }));
        this.toDispose.push(this.editorManager.onCreated(async _editorWidget => {
            this.updateOpenWidgets();
            this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
        }));


        // this.toDispose.push(this.applicationShell.onDidChangeActiveWidget(async () => {
        //     this.updateOpenWidgets();
        //     this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
        // }));
        // this.applicationShell.mainPanel.widgetAdded.connect(async (_, widget) => {
        //     setTimeout(async () => {
        //         this.updateOpenWidgets();
        //         this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
        //         console.log('SENTINEL MAIN PANEL ADDED', widget);
        //     });
        // });
        this.applicationShell.mainPanel.widgetRemoved.connect(async (_, widget) => {
            setTimeout(async () => {
                this.updateOpenWidgets();
                this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
                console.log('SENTINEL MAIN PANEL REMOVED', widget);
            });
        });
        // this.toDispose.push(this.applicationShell.onDidRemoveWidget(widget => {
        //     if (Saveable.get(widget)) {
        //         setTimeout(async () => {
        //             this.updateOpenWidgets();
        //             this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
        //         });
        //     }
        // }));
        this.updateOpenWidgets();
        this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
        this.fireChanged();
    }

    protected updateOpenWidgets(): void {
        // const widgets = this.applicationShell.getWidgets('main').filter(widget => Saveable.get(widget));
        const widgets = this.editorManager.all;
        console.log('SENTINEL WIDGETS WITH OPEN EDITORS', widgets);
        this.openWidgets = widgets;
        // let previewWidget: EditorPreviewWidget | undefined = undefined;
        // let validWidgets = new Set<EditorWidget | EditorPreviewWidget>();
        // for (const widget of widgets) {
        //     if (Saveable.get(widget) && (widget instanceof EditorWidget || widget instanceof EditorPreviewWidget)) {
        //         if (widget instanceof EditorPreviewWidget) {
        //             previewWidget = widget;
        //         }
        //         validWidgets.add(widget);
        //     }
        // }
        // console.log('SENTINEL BEFORE FILTERED WIDGETS', Array.from(validWidgets));
        // if (previewWidget && previewWidget.editorWidget) {
        //     validWidgets.delete(previewWidget.editorWidget);
        // }
        // this.openWidgets = Array.from(validWidgets);
    }

    protected async buildRootFromOpenedWidgets(_widgets: Widget[]): Promise<CompositeTreeNode> {
        const newRoot: CompositeTreeNode = {
            id: 'open-editors:root',
            parent: undefined,
            visible: false,
            children: []
        };
        for (const widget of this.openWidgets) {
            if (Navigatable.is(widget)) {
                const uri = widget.getResourceUri();
                if (uri) {
                    const fileStat = await this.fileService.resolve(uri);
                    const openEditorNode: FileStatNode = {
                        id: widget.id,
                        fileStat,
                        uri,
                        selected: false,
                        parent: undefined,
                        name: widget.title.label,
                        icon: widget.title.iconClass,
                        // children: []
                    };
                    CompositeTreeNode.addChild(newRoot, openEditorNode);
                }
            }

        }
        // this.openWidgets.forEach(widget => {
        // // });
        return newRoot;
    }
}
