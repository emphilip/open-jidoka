# Spec Delta

## MODIFIED Requirements

### Requirement: Drafts
A workflow SHALL have one editable draft BPMN document. Creating a workflow without BPMN SHALL produce a draft containing a single start event. Imported BPMN without diagram layout SHALL be given a generated layout so it can be displayed. A generated layout SHALL draw every sequence flow and place elements along the process's flow, including branches, whether or not the BPMN declares each element's incoming and outgoing flow references.

#### Scenario: Import BPMN authored as code
- **WHEN** a workflow is created with BPMN XML that has no diagram interchange
- **THEN** the stored draft contains generated shape positions and opens in the modeler

#### Scenario: Flows declared only by source and target
- **WHEN** a workflow is created from BPMN without diagram interchange whose elements list no incoming or outgoing references
- **THEN** the generated layout contains a drawn connection for every sequence flow and gateway branches are placed side by side

## ADDED Requirements

### Requirement: Display of diagrams without drawn connections
When a stored draft or published version has at least one sequence flow but no drawn connections, every API response that returns its diagram (workflow draft, published version, run detail) SHALL contain a regenerated layout. Published versions SHALL remain unchanged in storage. Diagrams with at least one drawn connection SHALL be returned as stored.

#### Scenario: Run of a version stored without connections
- **WHEN** a run's published version was stored with shapes but no drawn connections and the run is opened
- **THEN** the run diagram shows every sequence flow, and the stored version XML is unchanged

#### Scenario: Draft repaired on save
- **WHEN** a draft stored without drawn connections is opened in the modeler and saved
- **THEN** the stored draft contains the regenerated layout with its connections

#### Scenario: Hand-arranged diagram
- **WHEN** a diagram has drawn connections, even if some flows lack one
- **THEN** it is returned exactly as stored
